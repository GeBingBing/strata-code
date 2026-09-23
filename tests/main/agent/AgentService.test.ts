import { describe, expect, it, vi } from 'vitest'
import { AgentService } from '../../../src/main/agent/AgentService'
import type { AgentServiceOptions } from '../../../src/main/agent/AgentService'
import type { WebContentsLike } from '../../../src/main/ipc-interfaces'
import { createMockQuery } from '../../mocks/sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/** spec: agent-service AC-1~8 */

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
    apiKeySource: 'none',
    claude_code_version: 'test',
    cwd: '/tmp',
    tools: [],
    mcp_servers: [],
    model: 'test-model',
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    uuid: 'u-init',
    session_id: sessionId
  }) as unknown as SDKMessage

const resultMessage = (sessionId: string): SDKMessage =>
  ({
    type: 'result',
    subtype: 'success',
    duration_ms: 1234,
    duration_api_ms: 1000,
    is_error: false,
    num_turns: 1,
    result: 'done',
    stop_reason: 'end_turn',
    total_cost_usd: 0.05,
    usage: { input_tokens: 1, output_tokens: 1 },
    modelUsage: {},
    permission_denials: [],
    uuid: 'u-result',
    session_id: sessionId
  }) as unknown as SDKMessage

const serviceOptions = (extra: Partial<AgentServiceOptions> = {}): AgentServiceOptions => ({
  cwd: '/tmp',
  onSessionStart: vi.fn(),
  ...extra
})

/** spec: agent-env-config AC-4 —— env 透传到 query options */
describe('AgentService env 透传', () => {
  it('options.env 原样传入 query()（AC-4）', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-env')])
    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
      ANTHROPIC_MODEL: 'MiniMax-M2'
    }
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({ env: env as Record<string, string | undefined> })
    )

    await service.send('hi')
    await vi.waitFor(() => {
      expect(mock.lastOptions()).toBeDefined()
    })
    expect(mock.lastOptions()?.env).toMatchObject({
      ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
      ANTHROPIC_MODEL: 'MiniMax-M2'
    })
    await service.dispose()
  })
})

describe('AgentService', () => {
  it('AC-1: send 的文本推入输入流（PromptQueue → factory 收到 SDKUserMessage）', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hello agent')
    await new Promise((r) => setTimeout(r, 10))

    expect(mock.receivedInputs()).toHaveLength(1)
    expect(mock.receivedInputs()[0].message.content).toBe('hello agent')
    await service.dispose()
  })

  it('AC-2: 每条 SDKMessage 以信封发出，seq 单调递增', async () => {
    const { win, sent } = createFakeWin()
    const mock = createMockQuery([initMessage('s-1'), resultMessage('s-1')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(sent.filter((s) => s.channel === 'agent:message')).toHaveLength(2)
    })

    const envelopes = sent
      .filter((s) => s.channel === 'agent:message')
      .map((s) => s.payload as { sessionId: string; seq: number })
    expect(envelopes[0].seq).toBeLessThan(envelopes[1].seq)
    expect(envelopes.every((e) => e.sessionId === 's-1')).toBe(true)
    await service.dispose()
  })

  it('AC-4: result 消息 → agent:status idle + cost/duration', async () => {
    const { win, sent } = createFakeWin()
    const mock = createMockQuery([initMessage('s-2'), resultMessage('s-2')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(
        sent.some(
          (s) =>
            s.channel === 'agent:status' &&
            (s.payload as { status: string }).status === 'idle'
        )
      ).toBe(true)
    })

    const idle = sent
      .filter((s) => s.channel === 'agent:status')
      .map((s) => s.payload as { status: string; costUsd?: number; durationMs?: number })
      .find((p) => p.status === 'idle')
    expect(idle?.costUsd).toBeCloseTo(0.05)
    expect(idle?.durationMs).toBe(1234)
    await service.dispose()
  })

  it('AC-6: 捕获 session id 并回调 onSessionStart', async () => {
    const { win } = createFakeWin()
    const onSessionStart = vi.fn()
    const mock = createMockQuery([initMessage('s-capture')])
    const service = new AgentService(win, mock.factory, serviceOptions({ onSessionStart }))

    await service.send('hi')
    await vi.waitFor(() => {
      expect(onSessionStart).toHaveBeenCalledWith('s-capture')
    })
    expect(service.currentSessionId).toBe('s-capture')
    await service.dispose()
  })

  it('AC-3/7: interrupt 与 setPermissionMode 代理到 Query', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-3')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(service.isRunning).toBe(true)
    })

    await service.interrupt()
    await service.setPermissionMode('acceptEdits')

    expect(mock.interrupt).toHaveBeenCalledTimes(1)
    expect(mock.setPermissionMode).toHaveBeenCalledWith('acceptEdits')
    await service.dispose()
  })

  it('currentCwd / currentPermissionMode / currentModel 反映真实状态（app-config AC-1/4/5/6）', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-getters')])
    const service = new AgentService(
      win,
      mock.factory,
      serviceOptions({ cwd: '/project', permissionMode: 'acceptEdits' })
    )

    expect(service.currentCwd).toBe('/project')
    expect(service.currentPermissionMode).toBe('acceptEdits')
    expect(service.currentModel).toBeNull()

    await service.send('hi')
    await vi.waitFor(() => {
      expect(service.currentModel).toBe('test-model')
    })

    await service.setPermissionMode('default')
    expect(service.currentPermissionMode).toBe('default')

    await service.dispose()
  })

  it('setCwd / setModel 影响后续新查询的 options（app-config AC-3/6）', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-options')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    service.setCwd('/new/cwd')
    service.setModel('claude-opus-4-8')
    await service.setPermissionMode('plan')

    await service.send('hi')
    await vi.waitFor(() => {
      expect(mock.lastOptions()).toBeDefined()
    })

    const options = mock.lastOptions()!
    expect(options.cwd).toBe('/new/cwd')
    expect(options.model).toBe('claude-opus-4-8')
    expect(options.permissionMode).toBe('plan')

    await service.dispose()
  })

  it('AC-5: 流异常 → agent:error + 状态复位', async () => {
    const { win, sent } = createFakeWin()
    const boom = new Error('boom')
    const failingFactory = (): never => {
      throw boom
    }
    // factory 同步抛出也必须走 error 路径
    const service = new AgentService(win, failingFactory as never, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(
        sent.some(
          (s) =>
            s.channel === 'agent:error' &&
            (s.payload as { error: string }).error.includes('boom')
        )
      ).toBe(true)
    })
    expect(service.isRunning).toBe(false)
  })

  it('AC-8: dispose → abortController.abort 被调用', async () => {
    const { win } = createFakeWin()
    let aborted = false
    const mock = createMockQuery([initMessage('s-8')])
    const wrappingFactory = (p: { prompt: AsyncIterable<never>; options: { abortController?: AbortController } }) => {
      p.options.abortController?.signal.addEventListener('abort', () => {
        aborted = true
      })
      return mock.factory(p as never)
    }
    const service = new AgentService(win, wrappingFactory as never, serviceOptions())

    await service.send('hi')
    await vi.waitFor(() => {
      expect(service.isRunning).toBe(true)
    })

    await service.dispose()
    expect(aborted).toBe(true)
    expect(service.isRunning).toBe(false)
  })

  it('多轮：运行中再次 send → 推入同一输入流', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-multi')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('first')
    await vi.waitFor(() => {
      expect(service.isRunning).toBe(true)
    })
    await service.send('second')
    await new Promise((r) => setTimeout(r, 10))

    const texts = mock.receivedInputs().map((m) => m.message.content)
    expect(texts).toContain('first')
    expect(texts).toContain('second')
    await service.dispose()
  })

  it('会话切换：send 带 resume 且不同 id → 重启查询并带 resume 选项', async () => {
    const { win } = createFakeWin()
    const mock = createMockQuery([initMessage('s-old')])
    const service = new AgentService(win, mock.factory, serviceOptions())

    await service.send('in old session')
    await vi.waitFor(() => {
      expect(service.currentSessionId).toBe('s-old')
    })
    mock.end()
    await vi.waitFor(() => {
      expect(service.isRunning).toBe(false)
    })

    // 切换到新会话：factory 再次被调用且 options.resume = 's-new'
    await service.send('resume this', { resume: 's-new' })
    expect(service.currentSessionId).toBeNull() // 新查询尚未产出 init
    expect(mock.lastOptions()?.resume).toBe('s-new')
    await service.dispose()
  })
})
