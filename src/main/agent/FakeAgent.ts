import type { Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { QueryFactory } from './AgentService'

/**
 * APP_AGENT_MODE=fake 时的确定性 agent：回显用户消息并模拟一次工具调用回合。
 * 用于 E2E 与离线开发 —— 零网络、零子进程。
 *
 * 脚本：
 *   system(init) → system(memory_recall) → assistant(tool_use)
 *   → user(tool_result) → assistant(text) → result(success)
 *
 * memory_recall 与 num_turns=2 支撑记忆链路 E2E（spec: memory-distillation / memory-rendering）。
 */
export function createFakeQueryFactory(): QueryFactory {
  return ({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }) => {
    const iterator = prompt[Symbol.asyncIterator]()

    const run = async function* (): AsyncGenerator<SDKMessage> {
      const first = await iterator.next()
      const userText =
        first.done
          ? ''
          : typeof first.value.message.content === 'string'
            ? first.value.message.content
            : ''

      const sessionId = 'fake-session-0001'
      yield {
        type: 'system',
        subtype: 'init',
        apiKeySource: 'none',
        claude_code_version: '0.0.0-fake',
        cwd: process.cwd(),
        tools: ['Read', 'Bash', 'Edit'],
        mcp_servers: [],
        model: 'fake-model',
        permissionMode: 'default',
        slash_commands: [],
        output_style: 'default',
        skills: [],
        plugins: [],
        uuid: 'fake-init-uuid',
        session_id: sessionId
      } as unknown as SDKMessage

      // 记忆召回内联展示（spec: memory-rendering；零网络覆盖 SDK memory_recall 渲染路径）
      yield {
        type: 'system',
        subtype: 'memory_recall',
        mode: 'select',
        memories: [
          {
            path: '/fake/memory/preferences.md',
            scope: 'personal',
            content: 'User prefers concise TypeScript answers.'
          }
        ],
        uuid: 'fake-memory-recall-uuid',
        session_id: sessionId
      } as unknown as SDKMessage

      // 先调用工具（自然顺序：调用 → 结果 → 最终回复）
      yield {
        type: 'assistant',
        message: {
          id: 'fake-msg-1',
          role: 'assistant',
          model: 'fake-model',
          content: [
            {
              type: 'tool_use',
              id: 'fake-tool-1',
              name: 'Read',
              input: { file_path: '/tmp/example.txt' }
            }
          ],
          stop_reason: 'tool_use',
          type: 'message'
        },
        parent_tool_use_id: null,
        uuid: 'fake-assistant-uuid-1',
        session_id: sessionId
      } as unknown as SDKMessage

      yield {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'fake-tool-1',
              content: 'file content here'
            }
          ]
        },
        parent_tool_use_id: null,
        uuid: 'fake-user-uuid',
        session_id: sessionId
      } as unknown as SDKMessage

      // 最后给出最终回复（基于工具结果）
      yield {
        type: 'assistant',
        message: {
          id: 'fake-msg-2',
          role: 'assistant',
          model: 'fake-model',
          content: [{ type: 'text', text: `Echo: ${userText.slice(0, 20)} …done.` }],
          stop_reason: 'end_turn',
          type: 'message'
        },
        parent_tool_use_id: null,
        uuid: 'fake-assistant-uuid-2',
        session_id: sessionId
      } as unknown as SDKMessage

      // 注：不排空剩余输入 —— PromptQueue 未 end() 时 next() 会永久挂起，
      // 生成器必须在产出 result 后立即结束（consume 循环依赖生成器完成回到 idle）。

      yield {
        type: 'result',
        subtype: 'success',
        duration_ms: 100,
        duration_api_ms: 80,
        is_error: false,
        num_turns: 2,
        result: `Echo: ${userText.slice(0, 20)} …done.`,
        stop_reason: 'end_turn',
        total_cost_usd: 0.001,
        usage: { input_tokens: 1, output_tokens: 1 },
        modelUsage: {},
        permission_denials: [],
        uuid: 'fake-result-uuid',
        session_id: sessionId
      } as unknown as SDKMessage
    }

    return run() as unknown as Query
  }
}
