import { createHash, createHmac, randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

export type TingwuTaskStatus = 'ONGOING' | 'COMPLETED' | 'FAILED' | string;

export interface TingwuTaskInfo {
  taskId: string;
  status: TingwuTaskStatus;
  transcriptionUrl?: string;
  errorMessage?: string;
}

@Injectable()
export class TingwuClient {
  private readonly logger = new Logger('Tingwu');

  configured(): boolean {
    return Boolean(this.appKey() && this.accessKeyId() && this.accessKeySecret());
  }

  async createOfflineTask(input: {
    fileUrl: string;
    kind: 'speech' | 'video';
    taskKey?: string;
  }): Promise<{ taskId: string }> {
    const body: Record<string, unknown> = {
      AppKey: this.appKey(),
      Input: {
        SourceLanguage: 'cn',
        FileUrl: input.fileUrl,
        TaskKey: input.taskKey ?? '',
      },
      Parameters: {
        Transcription: {
          DiarizationEnabled: true,
          Diarization: { SpeakerCount: 0 },
        },
        ExtraParams: {
          OcrAuxiliaryEnabled: input.kind === 'video',
        },
      },
    };
    const json = await this.request('PUT', '/openapi/tingwu/v2/tasks', { type: 'offline' }, body);
    const taskId = asString(asRecord(json.Data).TaskId) || asString(json.TaskId);
    if (!taskId) {
      throw new Error(asString(json.Message) || '听悟未返回任务编号');
    }
    return { taskId };
  }

  async getTask(taskId: string): Promise<TingwuTaskInfo> {
    const json = await this.request(
      'GET',
      `/openapi/tingwu/v2/tasks/${encodeURIComponent(taskId)}`,
      {},
      null,
    );
    const data = asRecord(json.Data);
    const result = asRecord(data.Result);
    const status = (asString(data.TaskStatus) || 'ONGOING').toUpperCase();
    const failed = status === 'FAILED' || status === 'INVALID';
    return {
      taskId: asString(data.TaskId) || taskId,
      status,
      transcriptionUrl: asString(result.Transcription) || undefined,
      errorMessage: failed
        ? asString(data.ErrorMessage) || asString(json.Message) || '听悟任务失败'
        : undefined,
    };
  }

  async fetchTranscription(url: string): Promise<{
    transcript: string;
    segments: Array<{ speaker?: string; text: string; startMs?: number; endMs?: number }>;
  }> {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      throw new Error(`听悟转写结果 ${res.status}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return parseTranscription(json);
  }

  private appKey(): string {
    return process.env.TINGWU_APP_KEY?.trim() ?? '';
  }

  private accessKeyId(): string {
    return (
      process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() ||
      process.env.ALIYUN_ACCESS_KEY_ID?.trim() ||
      ''
    );
  }

  private accessKeySecret(): string {
    return (
      process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() ||
      process.env.ALIYUN_ACCESS_KEY_SECRET?.trim() ||
      ''
    );
  }

  private host(): string {
    const region = (process.env.TINGWU_REGION ?? 'cn-beijing').trim() || 'cn-beijing';
    return `tingwu.${region}.aliyuncs.com`;
  }

  private async request(
    method: 'GET' | 'PUT',
    path: string,
    query: Record<string, string>,
    body: Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    if (!this.configured()) {
      throw new Error('未配置通义听悟（TINGWU_APP_KEY 与阿里云 AccessKey）');
    }
    const payload = body ? JSON.stringify(body) : '';
    const headers = signAcs3({
      method,
      host: this.host(),
      path,
      query,
      payload,
      accessKeyId: this.accessKeyId(),
      accessKeySecret: this.accessKeySecret(),
    });
    const search = new URLSearchParams(query).toString();
    const url = `https://${this.host()}${path}${search ? `?${search}` : ''}`;
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : payload,
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      json = { Message: raw.slice(0, 300) };
    }
    const code = asString(json.Code) || String(res.status);
    if (!res.ok || (code && code !== '0' && code !== '200')) {
      const message = asString(json.Message) || `听悟 ${res.status}`;
      this.logger.warn(`听悟 ${method} ${path} 失败: ${message}`);
      throw new Error(message);
    }
    return json;
  }
}

function signAcs3(input: {
  method: string;
  host: string;
  path: string;
  query: Record<string, string>;
  payload: string;
  accessKeyId: string;
  accessKeySecret: string;
}): Record<string, string> {
  const hashedPayload = sha256Hex(input.payload);
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const nonce = randomUUID().replace(/-/g, '');
  const headers: Record<string, string> = {
    host: input.host,
    'content-type': 'application/json',
    'x-acs-date': date,
    'x-acs-content-sha256': hashedPayload,
    'x-acs-signature-nonce': nonce,
    'x-acs-version': '2023-09-30',
  };
  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const signedHeaders = signedNames.join(';');
  const canonicalQuery = Object.keys(input.query)
    .sort()
    .map((key) => `${percent(key)}=${percent(input.query[key])}`)
    .join('&');
  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');
  const stringToSign = `ACS3-HMAC-SHA256\n${sha256Hex(canonicalRequest)}`;
  const signature = createHmac('sha256', input.accessKeySecret).update(stringToSign).digest('hex');
  headers.authorization = `ACS3-HMAC-SHA256 Credential=${input.accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;
  return headers;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function percent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function parseTranscription(json: Record<string, unknown>): {
  transcript: string;
  segments: Array<{ speaker?: string; text: string; startMs?: number; endMs?: number }>;
} {
  const root = asRecord(json.Transcription) ?? json;
  const paragraphs = asArray(root.Paragraphs).length ? asArray(root.Paragraphs) : asArray(root.paragraphs);
  const segments: Array<{ speaker?: string; text: string; startMs?: number; endMs?: number }> = [];
  for (const item of paragraphs) {
    const row = asRecord(item);
    const text = asString(row.Text) || asString(row.text) || wordsText(row);
    if (!text) continue;
    segments.push({
      speaker: asString(row.SpeakerId) || asString(row.speakerId) || asString(row.SpeakerName) || undefined,
      text,
      startMs: toMs(row.Begin || row.begin || row.Start),
      endMs: toMs(row.End || row.end),
    });
  }
  if (!segments.length) {
    const transcript = asString(root.Text) || asString(json.Text) || asString(json.text);
    return { transcript, segments: transcript ? [{ text: transcript }] : [] };
  }
  return {
    transcript: segments.map((item) => item.text).join('\n'),
    segments,
  };
}

function wordsText(row: Record<string, unknown>): string {
  return asArray(row.Words)
    .map((item) => asString(asRecord(item).Text) || asString(asRecord(item).text))
    .filter(Boolean)
    .join('');
}

function toMs(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
