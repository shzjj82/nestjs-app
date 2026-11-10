import { mergeConversationHistory } from '../../src/chat/conversation-history';

describe('mergeConversationHistory', () => {
  it('keeps incoming messages for a new conversation', () => {
    expect(
      mergeConversationHistory(
        [],
        [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
      ),
    ).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
  });

  it('appends only the latest user turn onto stored history', () => {
    expect(
      mergeConversationHistory(
        [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
        ],
        [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' },
        ],
      ),
    ).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
  });
});
