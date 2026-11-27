export function encodeSse(event: unknown): string {
  return `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`;
}
