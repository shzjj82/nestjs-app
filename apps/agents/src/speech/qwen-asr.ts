import { rpcFail } from '../common/rpc';
import { aiAsrApiBase, aiAsrApiKey, aiAsrModel, aiTimeoutMs } from '../chat/chat-env';

export async function transcribeQwen(input: { audioBase64: string; mime: string }): Promise<string> {
  const key = aiAsrApiKey();
  if (!key) rpcFail(503, '未配置语音识别密钥，请设置 AI_ASR_API_KEY 或 AI_API_KEY');
  const payload = input.audioBase64.replace(/^data:[^,]*,/, '').replace(/\s/g, '');
  if (!payload) rpcFail(400, '没有录音内容');
  let bytes = 0;
  try {
    bytes = Buffer.from(payload, 'base64').byteLength;
  } catch {
    rpcFail(400, '录音内容无法读取');
  }
  if (!bytes) rpcFail(400, '没有录音内容');
  if (bytes > 8 * 1024 * 1024) rpcFail(400, '录音文件请控制在 8MB 以内');
  const format = audioFormat(input.mime);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(aiTimeoutMs(), 60_000));
  try {
    const response = await fetch(`${aiAsrApiBase()}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: aiAsrModel(),
        messages: [{
          role: 'user',
          content: [{ type: 'input_audio', input_audio: { data: payload, format } }],
        }],
        stream: false,
        asr_options: { language: 'zh', enable_itn: false },
      }),
    });
    const raw = await response.text();
    if (!response.ok) rpcFail(502, asrErrorMessage(raw));
    const transcript = messageText(safeJson(raw)).trim();
    if (!transcript) rpcFail(502, '没有识别到语音内容');
    return transcript;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      rpcFail(504, '语音识别超时');
    }
    rpcFail(502, '语音识别暂时不可用，请稍后重试或改为文字填写');
  } finally {
    clearTimeout(timer);
  }
}

function audioFormat(mime: string): string {
  const normalized = mime.toLowerCase().split(';')[0]?.trim() ?? '';
  const table: Record<string, string> = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
  };
  const format = table[normalized];
  if (!format) rpcFail(400, '请上传 webm、wav、mp3、m4a 或 ogg 录音');
  return format;
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function messageText(data: Record<string, unknown>): string {
  const choices = data.choices;
  const first = Array.isArray(choices) ? choices[0] as Record<string, unknown> | undefined : undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '');
      return '';
    }).join('');
  }
  return '';
}

function asrErrorMessage(raw: string): string {
  const data = safeJson(raw);
  const error = data.error as Record<string, unknown> | undefined;
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/api.key|invalid.*key|unauthorized/i.test(message)) return '语音识别密钥无效，请检查 AI_ASR_API_KEY 或 AI_API_KEY';
  if (/model/i.test(message)) return '当前语音识别模型不可用，请确认已开通 qwen3-asr-flash';
  return '语音识别失败，请稍后重试或改为文字填写';
}
