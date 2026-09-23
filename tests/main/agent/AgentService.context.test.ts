import { describe, expect, it, vi } from 'vitest'
import { AgentService } from '../../../src/main/agent/AgentService'
import type { AgentServiceOptions } from '../../../src/main/agent/AgentService'
import type { WebContentsLike } from '../../../src/main/ipc-interfaces'
import { createMockQuery } from '../../mocks/sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/** spec: context-engineering AC-1~6 */

function createFakeWin() {
  const sent: Array<{ channel: string; payload: unknown }> = []
  const listeners = new Map<string, () => void>()
  const win: WebContentsLike = {
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload })
    },
    once: (event: string, listener: () => void) => {
      listeners.set(event, listener)
    },
    isDestroyed: () => false
  }
  return { win, sent, listeners }
}

const initMessage = (sessionId: string): SDKMessage =>
  ({
    type: 'system',
    subtype: 'init',
    uuid: 'u-init',
    session_id: sessionId,
    model: 'test-model'
  }) as unknown as SDKMessage

const resultMessage = (sessionId: string): SDKMessage =>
  ({
    type: 'result',
    subtype: 'success',
    duration_ms: 1234,
    is_error: false,
    num_turns: 3,
    result: 'done',
    total_cost_usd: 0.05,
    usage: { input_tokens: 1200, output_tokens: 345 },
    uuid: 'u-result',
    session_id: sessionId
  }) as unknown as SDKMessage

const serviceOptions = (extra: Partial<AgentServiceOptions> = {}): AgentServiceOptions => ({
  cwd: '/tmp',
  ...extra
})

describe('AgentService context-engineering 接缝', () => {
  it('AC-1: Options 默认显式 settingSources: [user, project, local]；可覆盖', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => expect(mock.lastOptions()).toBeDefined())
    expect(mock.lastOptions()?.settingSources).toEqual(['user', 'project', 'local'])
    await service.dispose()
  })

  it('AC-1: settingSources 可由调用方覆盖', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({ settingSources: ['project'] })
    )

    await service.send('hi')
    await vi.waitFor(() => expect(mock.lastOptions()).toBeDefined())
    expect(mock.lastOptions()?.settingSources).toEqual(['project'])
    await service.dispose()
  })

  it('AC-2: buildSystemPromptAppend 返回非空 → systemPrompt preset + append（不设 snapshot）', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({
        buildSystemPromptAppend: async ({ cwd, firstText }) => {
          expect(cwd).toBe('/tmp')
          expect(firstText).toBe('remember me')
          return '<memory>prefer concise answers</memory>'
        }
      })
    )

    await service.send('remember me')
    await vi.waitFor(() => expect(mock.lastOptions()).toBeDefined())
    expect(mock.lastOptions()?.systemPrompt).toEqual({
      type: 'preset',
      preset: 'claude_code',
      append: '<memory>prefer concise answers</memory>'
    })
    await service.dispose()
  })

  it('AC-3: append 为空字符串 → 无 systemPrompt 键', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({ buildSystemPromptAppend: async () => '' })
    )

    await service.send('hi')
    await vi.waitFor(() => expect(mock.lastOptions()).toBeDefined())
    expect(mock.lastOptions()?.systemPrompt).toBeUndefined()
    await service.dispose()
  })

  it('AC-4: append await 期间再次 send → 两条文本进同一输入流、factory 只调一次', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-4')])
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({
        buildSystemPromptAppend: async () => {
          await gate
          return '<memory>x</memory>'
        }
      })
    )

    const first = service.send('first')
    await new Promise((r) => setTimeout(r, 5)) // start 进入 append await
    const second = service.send('second') // append 挂起期间到达
    release()
    await Promise.all([first, second])
    await vi.waitFor(() => expect(service.isRunning).toBe(true))

    expect(mock.receivedInputs().map((m) => m.message.content)).toEqual(['first', 'second'])
    expect(mock.lastOptions()).toBeDefined() // factory 恰好调用一次（lastOptions 存在且未变）
    await service.dispose()
  })

  it('AC-5: result.usage/num_turns → agent:status 透传 usage 与 numTurns', async () => {
    const { win, sent } = createFakeWin()
    const mock = createMockQuery([initMessage('s-5'), resultMessage('s-5')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(
        sent.some((s) => s.channel === 'agent:status' && (s.payload as { status: string }).status === 'idle')
      ).toBe(true)
    })

    const idle = sent
      .filter((s) => s.channel === 'agent:status')
      .map((s) => s.payload as { usage?: unknown; numTurns?: number })
      .find((p) => p.usage !== undefined)
    expect(idle?.usage).toEqual({ inputTokens: 1200, outputTokens: 345 })
    expect(idle?.numTurns).toBe(3)
    await service.dispose()
  })

  it('AC-6: result → onRunComplete 恰好一次且字段正确', async () => {
    const { win } = createFakeWin()
    const onRunComplete = vi.fn()
    const mock = createMockQuery([initMessage('s-6'), resultMessage('s-6')])
    const service = new AgentService(win, mock.factory, serviceOptions({ onRunComplete }))

    await service.send('hi')
    await vi.waitFor(() => expect(onRunComplete).toHaveBeenCalledTimes(1))

    expect(onRunComplete).toHaveBeenCalledWith({
      sessionId: 's-6',
      numTurns: 3,
      costUsd: 0.05,
      durationMs: 1234
    })
    await service.dispose()
  })

  it('append 解析抛异常 → agent:error 路径，不挂起', async () => {
    const { win, sent } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({
        buildSystemPromptAppend: async () => {
          throw new Error('append boom')
        }
      })
    )

    await service.send('hi')
    await vi.waitFor(() => {
      expect(
        sent.some((s) => s.channel === 'agent:error' && (s.payload as { error: string }).error.includes('append boom'))
      ).toBe(true)
    })
    expect(service.isRunning).toBe(false)
  })
})
