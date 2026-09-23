import { describe, expect, it } from 'vitest'
import { createMockQuery } from './sdk'
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

/** Mock 基座自检：脚本化消息流正确产出 */
describe('createMockQuery', () => {
  it('产出脚本化 SDKMessage 序列并结束', async () => {
    const msg = { type: 'result', subtype: 'success' } as SDKMessage
    const mock = createMockQuery([msg])
    mock.end() // 标记流结束（迭代产出脚本后 done）

    const query = mock.factory({
      prompt: (async function* () {})(),
      options: {} as never
    })
    const received: SDKMessage[] = []
    for await (const m of query) {
      received.push(m)
    }
    expect(received).toEqual([msg])
  })

  it('pushMessage 运行中动态追加', async () => {
    const mock = createMockQuery([])
    const query = mock.factory({
      prompt: (async function* () {})(),
      options: {} as never
    })

    const iterator = query[Symbol.asyncIterator]()
    const first = iterator.next()
    mock.pushMessage({ type: 'result', subtype: 'success' } as SDKMessage)
    expect((await first).done).toBe(false)
  })

  it('记录输入流收到的用户消息与 options', async () => {
    const mock = createMockQuery([])
    const prompt = (async function* (): AsyncGenerator<SDKUserMessage> {
      yield { type: 'user', message: { role: 'user', content: 'in-1' }, parent_tool_use_id: null }
    })()
    mock.factory({ prompt, options: { includePartialMessages: true } as never })

    await new Promise((r) => setTimeout(r, 10))
    expect(mock.receivedInputs()[0].message.content).toBe('in-1')
    expect(mock.lastOptions()?.includePartialMessages).toBe(true)
  })
})
