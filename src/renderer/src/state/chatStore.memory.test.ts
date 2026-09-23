import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useChatStore } from './chatStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { EventChannel, EventPayload } from '@shared/ipc'

/** spec: memory hidden —— 记忆事件默默订阅，不展示给用户 */

type Handler = (payload: unknown) => void

function makeCapturingApi() {
  const handlers = new Map<string, Handler>()
  const api: RendererApi = {
    invoke: vi.fn(async () => undefined) as never,
    on: ((channel: EventChannel, cb: Handler) => {
      handlers.set(channel, cb)
      return () => handlers.delete(channel)
    }) as never
  }
  return { api, handlers }
}

beforeEach(() => {
  useChatStore.setState({ ...useChatStore.getState(), items: [], lastDistill: undefined })
})

describe('chatStore memory 事件订阅（默默注入）', () => {
  it('memory:recalled → 不向 items 注入 memory 条目', () => {
    const { api, handlers } = makeCapturingApi()
    setIpcOverride(api)
    useChatStore.getState().connect()

    handlers.get('memory:recalled')?.({
      sessionId: 's-1',
      source: 'app',
      memories: [{ id: 'm-1', kind: 'preference', content: 'User prefers TypeScript.' }]
    } as EventPayload<'memory:recalled'>)

    const items = useChatStore.getState().items
    expect(items.find((i) => i.kind === 'memory')).toBeUndefined()

    setIpcOverride(null)
  })

  it('memory:distilled → lastDistill 仍在内部更新（仅 UI 不展示）', () => {
    const { api, handlers } = makeCapturingApi()
    setIpcOverride(api)
    useChatStore.getState().connect()

    handlers.get('memory:distilled')?.({
      sessionId: 's-1',
      added: 2,
      updated: 1,
      retired: 0
    } as EventPayload<'memory:distilled'>)

    expect(useChatStore.getState().lastDistill).toMatchObject({ added: 2 })

    setIpcOverride(null)
  })
})
