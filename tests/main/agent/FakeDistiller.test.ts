import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { createFakeDistillQueryFactory } from '../../../src/main/agent/FakeDistiller'
import { createFakeQueryFactory } from '../../../src/main/agent/FakeAgent'
import { extractJson } from '../../../src/main/memory/distillPrompt'

/** spec: memory-distillation AC-10 —— FakeDistiller 脚本与 FakeAgent 门槛 */

async function collect(gen: AsyncGenerator<SDKMessage>): Promise<SDKMessage[]> {
  const out: SDKMessage[] = []
  for await (const m of gen) out.push(m)
  return out
}

describe('FakeDistiller', () => {
  it('产出 assistant(固定 JSON 提案) + result(success)，提案可被 extractJson 解析', async () => {
    const factory = createFakeDistillQueryFactory()
    const query = factory({
      prompt: 'distill this',
      options: {} as never
    })
    const messages = await collect(query[Symbol.asyncIterator]() as AsyncGenerator<SDKMessage>)

    expect(messages).toHaveLength(2)
    expect(messages[0].type).toBe('assistant')
    expect(messages[1].type).toBe('result')

    const text = (
      (messages[0] as unknown as { message: { content: Array<{ type: string; text?: string }> } })
        .message.content[0]
    ).text!
    const parsed = extractJson(text) as { add: Array<{ kind: string }>; retire: string[] }
    expect(Array.isArray(parsed.add)).toBe(true)
    expect(parsed.add.length).toBeGreaterThan(0)
    expect(parsed.add[0].kind).toBe('preference')
    expect(parsed.retire).toEqual([])
  })
})

describe('FakeAgent（蒸馏门槛与记忆召回脚本）', () => {
  it('result.num_turns = 2（满足默认 minTurns=2 的蒸馏门槛）', async () => {
    const factory = createFakeQueryFactory()
    const queue = (async function* () {
      yield { type: 'user', message: { role: 'user', content: 'hi' }, parent_tool_use_id: null } as never
    })()
    const query = factory({ prompt: queue, options: {} as never })
    const messages = await collect(query[Symbol.asyncIterator]() as AsyncGenerator<SDKMessage>)

    const result = messages.find((m) => m.type === 'result') as unknown as { num_turns: number }
    expect(result.num_turns).toBe(2)
  })

  it('yield 一条 memory_recall 系统消息（含 content，供渲染层内联展示）', async () => {
    const factory = createFakeQueryFactory()
    const queue = (async function* () {
      yield { type: 'user', message: { role: 'user', content: 'hi' }, parent_tool_use_id: null } as never
    })()
    const query = factory({ prompt: queue, options: {} as never })
    const messages = await collect(query[Symbol.asyncIterator]() as AsyncGenerator<SDKMessage>)

    const recall = messages.find(
      (m) => m.type === 'system' && (m as unknown as { subtype?: string }).subtype === 'memory_recall'
    ) as unknown as {
      mode: string
      memories: Array<{ path: string; scope: string; content?: string }>
    } | undefined
    expect(recall).toBeDefined()
    expect(recall!.mode).toBe('select')
    expect(recall!.memories[0].content).toBeTruthy()
  })
})
