import {
  LIST_TODOS,
  LOOKUP_MATERIAL,
  chatToolSpecs,
  chosenToolsFromCompletion,
  chosenToolsFromMessage,
} from '../../src/modules/chat/tool-choice';

describe('chosenToolsFromMessage', () => {
  it('keeps both tools from one response', () => {
    const chosen = chosenToolsFromMessage(
      {
        tool_calls: [
          { function: { name: LIST_TODOS, arguments: '{"query":"我的任务"}' } },
          { function: { name: LOOKUP_MATERIAL, arguments: '{"query":"报销制度"}' } },
        ],
      },
      '原话',
    );
    expect(chosen).toEqual([
      { name: LIST_TODOS, query: '我的任务' },
      { name: LOOKUP_MATERIAL, query: '报销制度' },
    ]);
  });

  it('returns nothing when the model does not call a tool', () => {
    expect(chosenToolsFromMessage({ content: '你好' }, '你好')).toEqual([]);
    expect(chosenToolsFromCompletion({ choices: [{ message: { content: '你好' } }] }, '你好')).toEqual(
      [],
    );
  });

  it('returns nothing when tool arguments are not json', () => {
    expect(
      chosenToolsFromMessage(
        { tool_calls: [{ function: { name: LOOKUP_MATERIAL, arguments: '{bad' } }] },
        '最小堆算法',
      ),
    ).toEqual([]);
    expect(chosenToolsFromCompletion('not-json', '最小堆算法')).toEqual([]);
  });

  it('appends later tools after the local ones', () => {
    const names = chatToolSpecs([
      {
        name: 'future_action',
        description: '以后的 MCP 工具',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '原话' } },
          required: ['query'],
        },
      },
    ]).map((tool) => tool.name);
    expect(names).toEqual([LOOKUP_MATERIAL, LIST_TODOS, 'future_action']);
  });
});
