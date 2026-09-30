import type { AgentChatAttachment, AgentChatInput } from '@app/common';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { normalizeMessages } from './chat-messages';

export function parseChatInput(payload: unknown): AgentChatInput {
  const data = asRecord(payload);
  if (!Array.isArray(data.messages)) {
    rpcFail(400, 'AI_EMPTY');
  }
  const messages = normalizeMessages(data.messages);
  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    rpcFail(400, 'AI_EMPTY');
  }
  return {
    messages,
    attachments: parseAttachments(data.attachments),
    system: optionalString(data.system),
    sync: data.sync !== false,
  };
}

function parseAttachments(raw: unknown): AgentChatAttachment[] {
  if (raw == null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    rpcFail(400, 'attachments 必须是数组');
  }
  const items: AgentChatAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (rec.kind === 'image') {
      const name = String(rec.name ?? '').trim();
      const url = String(rec.url ?? '').trim();
      if (name && url) {
        items.push({ kind: 'image', name, url });
      }
      continue;
    }
    if (rec.kind === 'text') {
      const name = String(rec.name ?? '').trim();
      const text = String(rec.text ?? '');
      if (name && text) {
        items.push({ kind: 'text', name, text });
      }
    }
  }
  return items;
}
