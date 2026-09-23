import type {
  Options,
  Query,
  SDKMessage,
  SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import { vi } from 'vitest'

/**
 * SDK query() 的脚本化替身。
 * - factory: 注入 AgentService 的 QueryFactory，产出脚本化消息流
 * - pushMessage/end: 测试运行中动态控制流
 * - receivedInputs: 记录 AgentService 推入输入流的用户消息（AC-1 断言用）
 * - interrupt/setPermissionMode: 间谍（AC-3/7 断言用）
 */
export interface MockQueryScript {
  factory: (p: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => Query
  pushMessage(msg: SDKMessage): void
  end(): void
  receivedInputs(): SDKUserMessage[]
  /** 最近一次 factory 调用收到的 options（断言 resume/includePartialMessages 等） */
  lastOptions(): Options | undefined
  interrupt: ReturnType<typeof vi.fn>
  setPermissionMode: ReturnType<typeof vi.fn>
}

export function createMockQuery(script: SDKMessage[] = []): MockQueryScript {
  const pending: SDKMessage[] = [...script]
  let wake: (() => void) | null = null
  let ended = false
  let lastOptions: Options | undefined
  const received: SDKUserMessage[] = []

  const interrupt = vi.fn(async () => undefined)
  const setPermissionMode = vi.fn(async (_mode: string) => undefined)

  const next = (): Promise<IteratorResult<SDKMessage>> =>
    new Promise((resolve) => {
      if (pending.length > 0) {
        resolve({ value: pending.shift()!, done: false })
        return
      }
      if (ended) {
        resolve({ value: undefined, done: true })
        return
      }
      wake = () => {
        wake = null
        if (pending.length > 0) resolve({ value: pending.shift()!, done: false })
        else if (ended) resolve({ value: undefined, done: true })
      }
    })

  const factory = (p: { prompt: AsyncIterable<SDKUserMessage>; options: Options }): Query => {
    lastOptions = p.options
    // 后台消费输入流，模拟 CLI 读取 prompt（测试可断言收到的输入）
    void (async () => {
      for await (const msg of p.prompt) received.push(msg)
    })()
    return {
      interrupt,
      setPermissionMode,
      setModel: vi.fn(async () => undefined),
      [Symbol.asyncIterator]: () => ({ next })
    } as unknown as Query
  }

  return {
    factory,
    pushMessage(msg: SDKMessage): void {
      pending.push(msg)
      wake?.()
    },
    end(): void {
      ended = true
      wake?.()
    },
    receivedInputs: () => received,
    lastOptions: () => lastOptions,
    interrupt,
    setPermissionMode
  }
}
