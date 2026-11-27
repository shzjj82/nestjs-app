import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { aiTimeoutMs, ocrConfigured, ocrModel } from '../ai/env';
import { asRecord, optionalString, rpcFail } from '@app/common';
import { OcrCacheEntity } from './cache.entity';
import { OcrItem, OcrJobEntity } from './job.entity';
import { requestOcrText } from './ocr-client';
import { mapPool } from '../support/map-pool';

const MAX_IMAGES = 9;
const INDEX_IMAGES = 8;
const TEXT_MAX = 80_000;

@Injectable()
export class OcrService {
  private readonly logger = new Logger('AgentsOcr');

  constructor(
    @InjectRepository(OcrCacheEntity) private readonly cache: Repository<OcrCacheEntity>,
    @InjectRepository(OcrJobEntity) private readonly jobs: Repository<OcrJobEntity>,
  ) {}

  /** 文件内嵌图片。按内容哈希缓存，同一张图重复索引不再请求模型。 */
  async textsForEmbedded(
    images: Array<{ bytes: Buffer; mime: string }>,
  ): Promise<string[]> {
    if (!images.length) {
      return [];
    }
    if (!ocrConfigured()) {
      this.logger.warn('skip embedded image ocr: AI_OCR_NOT_CONFIGURED');
      return [];
    }
    const recognized = await mapPool(images.slice(0, INDEX_IMAGES), 4, async (image) => {
      try {
        return (await this.recognizeBytes(image.bytes, image.mime)).trim().slice(0, TEXT_MAX);
      } catch (err) {
        this.logger.warn(
          `skip embedded image ocr: ${err instanceof Error ? err.message : String(err)}`,
        );
        return '';
      }
    });
    return recognized.filter(Boolean);
  }

  /** 索引用：失败或未配置的图片跳过，不让整篇文档索引失败。 */
  async textsForIndex(urls: string[]): Promise<Array<{ url: string; text: string }>> {
    if (!ocrConfigured()) {
      if (urls.length) {
        this.logger.warn('skip image ocr: AI_OCR_NOT_CONFIGURED');
      }
      return [];
    }
    const recognized = await mapPool(urls.slice(0, INDEX_IMAGES), 4, async (url) => {
      try {
        const text = (await this.recognizeUrl(url)).trim().slice(0, TEXT_MAX);
        return text ? { url, text } : null;
      } catch (err) {
        this.logger.warn(
          `skip image ocr ${url.slice(0, 120)}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    });
    return recognized.filter((item) => item !== null);
  }

  async recognize(payload: unknown) {
    requireCaller(payload);
    this.assertConfigured();
    const urls = imageUrlsOf(payload);
    const items = await this.recognizeAll(urls);
    return { items };
  }

  async createTask(payload: unknown) {
    const caller = requireCaller(payload);
    this.assertConfigured();
    const urls = imageUrlsOf(payload);
    const job = await this.jobs.save(
      this.jobs.create({
        id: randomBytes(12).toString('base64url').slice(0, 16),
        bizCode: caller.bizCode,
        accountId: caller.accountId,
        status: 'pending',
        imageUrls: urls,
        result: null,
        errorMessage: null,
        finishedAt: null,
      }),
    );
    void this.runJob(job.id);
    return { jobId: job.id, status: 'pending' };
  }

  async findTask(payload: unknown) {
    const caller = requireCaller(payload);
    const id = optionalString(asRecord(payload).id);
    if (!id) {
      rpcFail(400, '缺少任务 id');
    }
    const job = await this.jobs.findOne({
      where: { id, bizCode: caller.bizCode, accountId: caller.accountId },
    });
    if (!job) {
      rpcFail(404, '识别任务不存在');
    }
    return toJobView(job);
  }

  async *streamItems(payload: unknown): AsyncGenerator<OcrItem | { done: true; items: OcrItem[] }> {
    requireCaller(payload);
    this.assertConfigured();
    const urls = imageUrlsOf(payload);
    const items: OcrItem[] = [];
    for (const url of urls) {
      const item = await this.recognizeItem(url);
      items.push(item);
      yield item;
    }
    yield { done: true, items };
  }

  private async runJob(id: string) {
    const job = await this.jobs.findOne({ where: { id } });
    if (!job || job.status !== 'pending') {
      return;
    }
    await this.jobs.update(id, { status: 'running' });
    try {
      const items = await this.recognizeAll(job.imageUrls);
      await this.jobs.update(id, {
        status: 'done',
        result: { items },
        finishedAt: new Date(),
      });
    } catch (err) {
      await this.jobs.update(id, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : '识别失败',
        finishedAt: new Date(),
      });
    }
  }

  private async recognizeAll(urls: string[]): Promise<OcrItem[]> {
    const items: OcrItem[] = [];
    for (const url of urls) {
      items.push(await this.recognizeItem(url));
    }
    return items;
  }

  private async recognizeItem(url: string): Promise<OcrItem> {
    try {
      const text = (await this.recognizeUrl(url)).trim().slice(0, TEXT_MAX);
      return { url, text };
    } catch (err) {
      return {
        url,
        text: '',
        error: err instanceof Error ? err.message : '识别失败',
      };
    }
  }

  private async recognizeBytes(bytes: Buffer, mime: string): Promise<string> {
    const urlHash = createHash('sha256').update(bytes).digest('hex');
    const model = ocrModel();
    const cached = await this.cache.findOne({ where: { urlHash } });
    if (cached && cached.model === model) {
      return cached.text;
    }
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
    const text = await this.callOcr(dataUrl);
    await this.cache.save(
      this.cache.create({
        urlHash,
        url: `embedded:${urlHash}`,
        text,
        model,
      }),
    );
    return text;
  }

  private async recognizeUrl(url: string): Promise<string> {
    const urlHash = createHash('sha256').update(url).digest('hex');
    const model = ocrModel();
    const cached = await this.cache.findOne({ where: { urlHash } });
    if (cached && cached.model === model) {
      return cached.text;
    }
    const text = await this.callOcr(url);
    await this.cache.save(
        this.cache.create({
          urlHash,
          url,
          text,
          model,
        }),
      );
    return text;
  }

  private async callOcr(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
    try {
      return await requestOcrText(url, controller.signal);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('OCR_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private assertConfigured() {
    if (!ocrConfigured()) {
      rpcFail(503, 'AI_OCR_NOT_CONFIGURED');
    }
  }
}

function requireCaller(payload: unknown): { bizCode: string; accountId: string } {
  const body = asRecord(payload);
  const bizCode = optionalString(body._bizCode);
  const accountId = optionalString(asRecord(body._session).accountId);
  if (!bizCode) {
    rpcFail(400, '缺少业务标识');
  }
  if (!accountId) {
    rpcFail(401, '请使用账户登录后再识别');
  }
  return { bizCode, accountId };
}

export function imageUrlsOf(payload: unknown): string[] {
  const raw = asRecord(payload).imageUrls;
  const urls = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    : [];
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) {
    rpcFail(400, '请提供 imageUrls');
  }
  if (unique.length > MAX_IMAGES) {
    rpcFail(400, `一次最多识别 ${MAX_IMAGES} 张图片`);
  }
  for (const url of unique) {
    if (!/^https?:\/\//i.test(url) || url.length > 2000) {
      rpcFail(400, 'imageUrls 须为 http(s) 地址');
    }
  }
  return unique;
}

function toJobView(job: OcrJobEntity) {
  return {
    jobId: job.id,
    status: job.status,
    items: job.result?.items ?? [],
    error: job.errorMessage,
  };
}
