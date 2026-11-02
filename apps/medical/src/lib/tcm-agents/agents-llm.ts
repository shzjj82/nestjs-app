import type { AgentChatTool, AgentsClient } from '@app/common';
import type { ChatMessage, ChatTool, ToolCallPayload } from './deepseek';
import type { LlmPort } from './agent';

/** Skill 循环走 agents.complete，不在诊所进程里直连模型。 */
export class AgentsLlmAdapter implements LlmPort {
  readonly enabled = true;

  constructor(
    private readonly agents: AgentsClient,
    private readonly bizCode = 'medical',
  ) {}

  async chat(messages: ChatMessage[], opts?: { temperature?: number; reasoner?: boolean }) {
    const result = await this.completions(messages, opts);
    return result.content;
  }

  async completions(
    messages: ChatMessage[],
    opts?: { tools?: ChatTool[]; temperature?: number; reasoner?: boolean },
  ) {
    const result = await this.agents.complete({
      bizCode: this.bizCode,
      messages,
      tools: opts?.tools as AgentChatTool[] | undefined,
      temperature: opts?.temperature,
      reasoner: opts?.reasoner,
    });
    return {
      content: result.content,
      toolCalls: (result.toolCalls ?? []) as ToolCallPayload[],
    };
  }
}
