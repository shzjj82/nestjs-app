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

export function aiTimeoutMs(): number {
  const n = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

export function aiConfigured(): boolean {
  return Boolean(aiApiKey());
}
