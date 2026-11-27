import { ocrApiBase, ocrApiKey, ocrModel } from '../../ai/env';

const OCR_PROMPT =
  'Please output only the text content from the image without any additional descriptions or formatting.';

/** 从 OpenAI 兼容响应里取出识别文字。没有文字时返回空串。 */
export function textFromOcrMessage(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .join('')
    .trim();
}

export async function requestOcrText(url: string, signal?: AbortSignal): Promise<string> {
  const apiKey = ocrApiKey();
  if (!apiKey) {
    throw new Error('AI_OCR_NOT_CONFIGURED');
  }
  const res = await fetch(`${ocrApiBase()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      model: ocrModel(),
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url } },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OCR_${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return textFromOcrMessage(data.choices?.[0]?.message?.content);
}
