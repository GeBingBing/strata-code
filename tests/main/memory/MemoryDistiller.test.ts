import { describe, expect, it, vi } from 'vitest'
import type { Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { MemoryDistiller } from '../../../src/main/memory/MemoryDistiller'
import type { MemoryDistillerOptions } from '../../../src/main/memory/MemoryDistiller'
import type { MemoryStore } from '../../../src/main/memory/MemoryStore'
import type { WebContentsLike } from '../../../src/main/ipc-interfaces'
import type { MemoryEntry } from '@shared/types'

/** spec: memory-distillation AC-1~9 */

function createFakeWin() {
  const sent: Array<{ channel: string; payload: unknown }> = []
  const win: WebContentsLike = {
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload })
    },
    once: () => {},
    isDestroyed: () => false
  }
  return { win, sent }
}

/** 脚本化侧查询工厂：记录收到的参数，产出给定消息流 */
function scriptedQueryFactory(
  script: SDKMessage[] | (() => SDKMessage[] | Promise<SDKMessage[]>)
) {
  const calls: Array<{ prompt: string; options: Options }> = []
  let abortController: AbortController | null = null
  const factory = (p: { prompt: string; options: Options }): Query => {
    calls.push({ prompt: p.prompt, options: p.options })
    abortController = p.options.abortController ?? null
    const messages = typeof script === 'function' ? script() : [...script]
    const iterator = (async function* () {
      for (const m of await messages) yield m
    })()
    return {
      interrupt: vi.fn(async () => undefined),
      setPermissionMode: vi.fn(async () => undefined),
      setModel: vi.fn(async () => undefined),
      [Symbol.asyncIterator]: () => iterator
    } as unknown as Query
  }
  return {
    factory,
    calls: () => calls,
    abort: () => abortController?.abort()
  }
}

const assistantJson = (text: string): SDKMessage =>
  ({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
    uuid: 'u-distill',
    session_id: 's-distill'
  }) as unknown as SDKMessage

const resultOk: SDKMessage =
  ({
    type: 'result',
    subtype: 'success',
    duration_ms: 10,
    num_turns: 1,
    total_cost_usd: 0.001,
    result: '',
    usage: { input_tokens: 1, output_tokens: 1 },
    uuid: 'u-distill-result',
    session_id: 's-distill'
  }) as unknown as SDKMessage

const PROPOSAL = JSON.stringify({
  add: [{ kind: 'preference', scope: 'global', content: 'User prefers concise replies.', confidence: 0.8, tags: ['style'] }],
  retire: []
})

function makeStore(entries: MemoryEntry[] = []): MemoryStore {
  return {
    list: vi.fn(async () => [...entries]),
    replace: vi.fn(async () => undefined),
    upsert: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  } as unknown as MemoryStore
}

function makeDistiller(overrides: Partial<MemoryDistillerOptions> = {}) {
  const { win, sent } = createFakeWin()
  const store = overrides.store ?? makeStore()
  const distiller = new MemoryDistiller({
    store,
    win,
    queryFactory:
      overrides.queryFactory ??
      (() => {
        throw new Error('test must provide queryFactory')
      }),
    cwd: overrides.cwd ?? (() => '/proj'),
    readTranscript:
      overrides.readTranscript ??
      (async () => [{ type: 'user', message: { role: 'user', content: 'hi' } }]),
    minTurns: overrides.minTurns,
    maxTranscriptChars: overrides.maxTranscriptChars
  })
  return { distiller, win, sent, store }
}

const info = (numTurns = 3) => ({ sessionId: 's-1', numTurns, costUsd: 0.01, durationMs: 100 })

describe('MemoryDistiller', () => {
  it('AC-1: numTurns < minTurns → 不调 factory', async () => {
    const q = scriptedQueryFactory([])
    const { distiller } = makeDistiller({ queryFactory: q.factory })
    await distiller.onRunComplete(info(1))
    expect(q.calls()).toHaveLength(0)
  })

  it('AC-2: 转录为空 → 跳过；readTranscript 抛异常 → 不抛', async () => {
    const q = scriptedQueryFactory([])
    const { distiller } = makeDistiller({
      queryFactory: q.factory,
      readTranscript: async () => []
    })
    await distiller.onRunComplete(info())
    expect(q.calls()).toHaveLength(0)

    const { distiller: d2 } = makeDistiller({
      queryFactory: q.factory,
      readTranscript: () => Promise.reject(new Error('boom'))
    })
    await expect(d2.onRunComplete(info())).resolves.toBeUndefined()
    expect(q.calls()).toHaveLength(0)
  })

  it('AC-3: 超长转录 → prompt 中段截断', async () => {
    const q = scriptedQueryFactory([assistantJson(PROPOSAL), resultOk])
    const long = 'HEAD'.padEnd(50, 'h') + 'MIDDLE'.padEnd(50_000, 'm') + 'TAIL'.padEnd(50, 't')
    const { distiller } = makeDistiller({
      queryFactory: q.factory,
      readTranscript: async () => [{ type: 'user', message: { role: 'user', content: long } }]
    })
    await distiller.onRunComplete(info())
    expect(q.calls()).toHaveLength(1)
    expect(q.calls()[0].prompt).toContain('HEAD')
    expect(q.calls()[0].prompt).toContain('TAIL')
    expect(q.calls()[0].prompt).not.toContain('MIDDLE'.padEnd(50_000, 'm'))
    expect(q.calls()[0].prompt.length).toBeLessThan(30_000)
  })

  it('AC-4: factory 收到 string prompt + {maxTurns:1, cwd}，无 resume/canUseTool', async () => {
    const q = scriptedQueryFactory([assistantJson(PROPOSAL), resultOk])
    const { distiller } = makeDistiller({ queryFactory: q.factory })
    await distiller.onRunComplete(info())
    expect(q.calls()).toHaveLength(1)
    const { prompt, options } = q.calls()[0]
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('memory distillation')
    expect(options.maxTurns).toBe(1)
    expect(options.cwd).toBe('/proj')
    expect(options.resume).toBeUndefined()
    expect(options.canUseTool).toBeUndefined()
  })

  it('AC-5/6: 合法提案 → merge+prune 后 store.replace + memory:distilled 事件', async () => {
    const q = scriptedQueryFactory([assistantJson(PROPOSAL), resultOk])
    const store = makeStore([])
    const { distiller, sent } = makeDistiller({ queryFactory: q.factory, store })
    await distiller.onRunComplete(info())

    expect(store.replace).toHaveBeenCalledTimes(1)
    const replaced = (store.replace as ReturnType<typeof vi.fn>).mock.calls[0][0] as MemoryEntry[]
    expect(replaced).toHaveLength(1)
    expect(replaced[0]).toMatchObject({ kind: 'preference', content: 'User prefers concise replies.' })

    expect(sent).toHaveLength(1)
    expect(sent[0].channel).toBe('memory:distilled')
    expect(sent[0].payload).toEqual({ sessionId: 's-1', added: 1, updated: 0, retired: 0 })
  })

  it('AC-5: retire 提案移除现有条目', async () => {
    const proposal = JSON.stringify({ add: [], retire: ['e-old'] })
    const q = scriptedQueryFactory([assistantJson(proposal), resultOk])
    const existing: MemoryEntry[] = [
      {
        id: 'e-old',
        kind: 'fact',
        scope: 'global',
        cwd: null,
        content: 'obsolete fact',
        confidence: 0.7,
        hits: 1,
        tags: [],
        sourceSessionId: 's-0',
        createdAt: 1,
        updatedAt: 1
      }
    ]
    const store = makeStore(existing)
    const { distiller, sent } = makeDistiller({ queryFactory: q.factory, store })
    await distiller.onRunComplete(info())

    expect(store.replace).toHaveBeenCalledWith([])
    expect((sent[0].payload as { retired: number }).retired).toBe(1)
  })

  it('AC-8: factory 抛异常 → 吞掉不抛、无事件；JSON 全烂 → 同样', async () => {
    const failing = (): Query => {
      throw new Error('factory boom')
    }
    const { distiller, sent } = makeDistiller({ queryFactory: failing })
    await expect(distiller.onRunComplete(info())).resolves.toBeUndefined()
    expect(sent).toHaveLength(0)

    const q = scriptedQueryFactory([assistantJson('total garbage no json'), resultOk])
    const { distiller: d2, sent: sent2 } = makeDistiller({ queryFactory: q.factory })
    await expect(d2.onRunComplete(info())).resolves.toBeUndefined()
    expect(sent2).toHaveLength(0)
  })

  it('AC-7: 同 session in-flight 二次触发 → factory 只调一次', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const q = scriptedQueryFactory(async () => {
      await gate
      return [assistantJson(PROPOSAL), resultOk]
    })
    const { distiller } = makeDistiller({ queryFactory: q.factory })

    const first = distiller.onRunComplete(info())
    const second = distiller.onRunComplete(info())
    release()
    await Promise.all([first, second])
    expect(q.calls()).toHaveLength(1)
  })

  it('AC-9: dispose → abort 在途侧查询', async () => {
    let aborted = false
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const q = scriptedQueryFactory(async () => {
      await gate
      return [assistantJson(PROPOSAL), resultOk]
    })
    const wrappingFactory = (p: { prompt: string; options: Options }): Query => {
      p.options.abortController?.signal.addEventListener('abort', () => {
        aborted = true
      })
      return q.factory(p)
    }
    const { distiller } = makeDistiller({ queryFactory: wrappingFactory })

    const run = distiller.onRunComplete(info())
    // 等侧查询真正启动（factory 已被调用、脚本挂起）再 dispose
    await vi.waitFor(() => expect(q.calls()).toHaveLength(1))
    distiller.dispose()
    release()
    await run
    expect(aborted).toBe(true)
  })

  it('dispose 后到达的 onRunComplete → 直接跳过', async () => {
    const q = scriptedQueryFactory([assistantJson(PROPOSAL), resultOk])
    const { distiller } = makeDistiller({ queryFactory: q.factory })
    distiller.dispose()
    await distiller.onRunComplete(info())
    expect(q.calls()).toHaveLength(0)
  })
})
