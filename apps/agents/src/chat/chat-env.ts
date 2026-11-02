export function aiApiBase(): string {
  return (process.env.AI_API_BASE ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
}

export function aiApiKey(): string {
  return process.env.AI_API_KEY?.trim() ?? '';
}

export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
}

export function aiReasonerModel(): string {
  return process.env.AI_REASONER_MODEL?.trim() || aiModel();
}

export function aiVisionModel(): string {
  return process.env.AI_VISION_MODEL?.trim() || 'qwen-vl-max';
}

/** embedding 可与 chat 分家（如 chat=DeepSeek、embedding=通义） */
export function aiEmbeddingApiBase(): string {
  const dedicated = process.env.AI_EMBEDDING_API_BASE?.trim();
  if (dedicated) {
    return dedicated.replace(/\/+$/, '');
  }
  return aiApiBase();
}

export function aiEmbeddingApiKey(): string {
  const dedicated = process.env.AI_EMBEDDING_API_KEY?.trim();
  if (dedicated) {
    return dedicated;
  }
  return aiApiKey();
}

export function aiEmbeddingModel(): string {
  return process.env.AI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
}

/** 须与 ag_rag_chunks.embedding 维度及迁移一致 */
export function aiEmbeddingDim(): number {
  const n = Number(process.env.AI_EMBEDDING_DIM ?? 1536);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1536;
}

export function aiTimeoutMs(): number {
  const n = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

export function aiAsrApiBase(): string {
  const dedicated = process.env.AI_ASR_API_BASE?.trim();
  if (dedicated) return dedicated.replace(/\/+$/, '');
  if (process.env.AI_API_BASE?.trim()) return aiApiBase();
  return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
}

export function aiAsrApiKey(): string {
  return process.env.AI_ASR_API_KEY?.trim() || aiApiKey();
}

export function aiAsrModel(): string {
  const configured = (process.env.AI_ASR_MODEL ?? '').trim();
  if (configured && !/^paraformer-v2$/i.test(configured)) return configured;
  return 'qwen3-asr-flash';
}

export function asrConfigured(): boolean {
  return Boolean(aiAsrApiKey());
}

export function tingwuConfigured(): boolean {
  const key = process.env.TINGWU_APP_KEY?.trim();
  const id = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() || process.env.ALIYUN_ACCESS_KEY_ID?.trim();
  const secret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() || process.env.ALIYUN_ACCESS_KEY_SECRET?.trim();
  return Boolean(key && id && secret);
}

export function aiConfigured(): boolean {
  return Boolean(aiApiKey());
}

export function ragConfigured(): boolean {
  return Boolean(aiEmbeddingApiKey());
}
