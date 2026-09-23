import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { DistillQueryFactory } from '../memory/MemoryDistiller'

/**
 * APP_AGENT_MODE=fake 时的确定性蒸馏侧查询（spec: memory-distillation AC-10）。
 * 产出固定 JSON 提案 + result —— E2E 全链路零网络。
 */

const FAKE_PROPOSAL = JSON.stringify({
  add: [
    {
      kind: 'preference',
      scope: 'global',
      content: 'User prefers concise replies in fake mode.',
      confidence: 0.8,
      tags: ['style']
    }
  ],
  retire: []
})

export function createFakeDistillQueryFactory(): DistillQueryFactory {
  return (): Query => {
    const run = async function* (): AsyncGenerator<SDKMessage> {
      yield {
        type: 'assistant',
        message: {
          id: 'fake-distill-msg-1',
          role: 'assistant',
          model: 'fake-model',
          content: [{ type: 'text', text: FAKE_PROPOSAL }],
          stop_reason: 'end_turn',
          type: 'message'
        },
        parent_tool_use_id: null,
        uuid: 'fake-distill-assistant-uuid',
        session_id: 'fake-distill-session'
      } as unknown as SDKMessage

      yield {
        type: 'result',
        subtype: 'success',
        duration_ms: 10,
        duration_api_ms: 5,
        is_error: false,
        num_turns: 1,
        result: FAKE_PROPOSAL,
        stop_reason: 'end_turn',
        total_cost_usd: 0.0005,
        usage: { input_tokens: 1, output_tokens: 1 },
        modelUsage: {},
        permission_denials: [],
        uuid: 'fake-distill-result-uuid',
        session_id: 'fake-distill-session'
      } as unknown as SDKMessage
    }
    return run() as unknown as Query
  }
}
