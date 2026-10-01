import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { aiApiBase, aiApiKey, aiTimeoutMs, aiVisionModel } from '../chat/chat-env';
import { VisionImageEntity } from '../entities/vision-image.entity';
import { VisionJobEntity } from '../entities/vision-job.entity';
import { extractJson } from './extract-json';

const PROMPT_MAX = 20_000;

@Injectable()
export class VisionService {
  constructor(
    @InjectRepository(VisionJobEntity) private readonly jobs: Repository<VisionJobEntity>,
    @InjectRepository(VisionImageEntity) private readonly images: Repository<VisionImageEntity>,
  ) {}

  async parse(payload: unknown) {
    const body = asRecord(payload);
    const bizCode = optionalString(body._bizCode);
    const accountId = optionalString(asRecord(body._session).accountId);
    if (!bizCode) rpcFail(400, '缺少业务标识');
    if (!accountId) rpcFail(401, '请使用账户登录后再识别');

    const prompt = optionalString(body.prompt);
    if (!prompt) rpcFail(400, '请提供提示词 prompt');
    if (prompt.length > PROMPT_MAX) rpcFail(400, '提示词过长');

    const imageUrls = stringList(body.imageUrls);
    const imageKeys = stringList(body.imageKeys);
    const text = optionalString(body.text);
    if (!imageUrls.length && !text) rpcFail(400, '请提供图片或文本');

    const model = optionalString(body.model) || aiVisionModel();
    const job = await this.jobs.save(
      this.jobs.create({
        id: randomBytes(12).toString('base64url').slice(0, 16),
        bizCode,
        accountId,
        status: 'pending',
        model,
        prompt,
        result: null,
        errorMessage: null,
        finishedAt: null,
      }),
    );
    if (imageUrls.length) {
      await this.images.save(
        imageUrls.map((url, index) =>
          this.images.create({
            jobId: job.id,
            url,
            key: imageKeys[index] ?? '',
            sortOrder: index,
          }),
        ),
      );
    }

    try {
      const content = await callVision({
        model,
        prompt,
        text,
        imageUrls,
      });
      let json: unknown = null;
      try {
        json = extractJson(content);
      } catch {
        json = null;
      }
      await this.jobs.update(job.id, {
        status: 'done',
        result: { text: content, json },
        finishedAt: new Date(),
      });
      return {
        jobId: job.id,
        imageUrls,
        model,
        text: content,
        json,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      const message = error instanceof Error ? error.message : '识别调用失败';
      await this.jobs.update(job.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
      });
      rpcFail(502, message);
    }
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

async function callVision(params: {
  model: string;
  prompt: string;
  text?: string;
  imageUrls: string[];
}): Promise<string> {
  const apiKey = aiApiKey();
  if (!apiKey) rpcFail(503, '未配置 AI_API_KEY');
  const content: Array<Record<string, unknown>> = params.imageUrls.map((url) => ({
    type: 'image_url',
    image_url: { url },
  }));
  const text = [params.prompt, params.text].filter(Boolean).join('\n\n');
  content.push({ type: 'text', text });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const res = await fetch(`${aiApiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model,
        temperature: 0.2,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`视觉模型 ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const message = data.choices?.[0]?.message?.content;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const joined = message
        .map((part) => (typeof part === 'string' ? part : part.text || ''))
        .join('')
        .trim();
      if (joined) return joined;
    }
    throw new Error('视觉模型响应中未找到可用文本内容');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('视觉模型调用超时');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
