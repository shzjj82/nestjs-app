import type { NormalizedMessage } from './chat-messages';

export const CONVERSATION_HISTORY_LIMIT = 24;

/**
 * 有库历史时只把本轮最后一条 user 接在后面，避免客户端复述整段造成重复；
 * 新会话则沿用客户端 messages（可含本地草稿历史）。
 */
export function mergeConversationHistory(
  history: NormalizedMessage[],
  incoming: NormalizedMessage[],
): NormalizedMessage[] {
  if (!incoming.length) {
    return history.slice(-CONVERSATION_HISTORY_LIMIT);
  }
  if (!history.length) {
    return incoming.slice(-CONVERSATION_HISTORY_LIMIT);
  }
  const lastUser = [...incoming].reverse().find((item) => item.role === 'user');
  if (!lastUser) {
    return history.slice(-CONVERSATION_HISTORY_LIMIT);
  }
  return [...history, lastUser].slice(-CONVERSATION_HISTORY_LIMIT);
}
