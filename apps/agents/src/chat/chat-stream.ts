export function splitSseBlocks(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  const events: string[] = [];
  for (const block of parts) {
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('data:')) {
        events.push(line.slice(5).trimStart());
      }
    }
  }
  return { events, rest };
}

export function contentFromUpstreamData(data: string): string {
  if (!data || data === '[DONE]') {
    return '';
  }
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return json.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

export function encodeSse(event: unknown): string {
  return `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`;
}
