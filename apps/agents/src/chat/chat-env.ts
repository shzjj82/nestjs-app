export function aiApiBase(): string {
  return (process.env.AI_API_BASE ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
}

export function aiApiKey(): string {
  return process.env.AI_API_KEY?.trim() ?? '';
}

export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
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

export function aiConfigured(): boolean {
  return Boolean(aiApiKey());
}

export function ragConfigured(): boolean {
  return Boolean(aiEmbeddingApiKey());
}
