import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import { useChatStore } from '../../state/chatStore'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: app-config —— StatusBar 显示配置与切换工作目录 */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  setIpcOverride(makeApi())
  useChatStore.setState({
    status: 'idle',
    costUsd: 0.0123,
    items: [],
    streamingId: null,
    usage: undefined,
    numTurns: undefined,
    lastDistill: undefined
  })
  useConfigStore.setState({
    cwd: '/project',
    permissionMode: 'acceptEdits',
    model: 'claude-sonnet-4-6-20251001',
    agentMode: 'real',
    loaded: true,
    load: useConfigStore.getState().load,
    pickWorkspace: useConfigStore.getState().pickWorkspace,
    setPermissionMode: useConfigStore.getState().setPermissionMode,
    setModel: useConfigStore.getState().setModel
  })
})

describe('StatusBar', () => {
  it('显示当前状态、工作目录、权限模式、模型与成本', () => {
    render(<StatusBar />)
    expect(screen.getByTestId('status-bar')).toHaveTextContent('空闲')
    expect(screen.getByTestId('status-cwd')).toHaveTextContent('/project')
    expect(screen.getByTestId('status-mode')).toHaveTextContent('acceptEdits')
    expect(screen.getByTestId('status-model')).toHaveTextContent('claude-sonnet-4-6-20251001')
    expect(screen.getByTestId('status-bar')).toHaveTextContent('$0.0123')
  })

  it('点击 cwd 触发 workspace:pick', async () => {
    invokeMock.mockResolvedValueOnce('/new/project')
    render(<StatusBar />)

    fireEvent.click(screen.getByTestId('status-cwd'))
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('workspace:pick')
    })
  })

  it('运行中禁用 cwd 切换', () => {
    useChatStore.setState({ status: 'running' })
    render(<StatusBar />)
    expect((screen.getByTestId('status-cwd') as HTMLButtonElement).disabled).toBe(true)
  })

  it('fake 模式显示 fake 标签', () => {
    useConfigStore.setState({ agentMode: 'fake' })
    render(<StatusBar />)
    expect(screen.getByTestId('status-agent-mode')).toHaveTextContent('fake')
  })

  it('spec: context-engineering AC-7 —— 显示 token 用量', () => {
    useChatStore.setState({
      usage: { inputTokens: 1200, outputTokens: 345 }
    } as never)
    render(<StatusBar />)
    expect(screen.getByTestId('status-tokens')).toHaveTextContent('1.2k')
    expect(screen.getByTestId('status-tokens')).toHaveTextContent('345')
  })

  it('无 usage 时不显示 token 段', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('status-tokens')).toBeNull()
  })

  /** spec: memory hidden —— 蒸馏徽标不再展示给用户 */
  it('不显示蒸馏徽标（默默蒸馏）', () => {
    useChatStore.setState({
      lastDistill: { added: 2, updated: 0, retired: 0, updatedAt: Date.now() }
    } as never)
    render(<StatusBar />)
    expect(screen.queryByTestId('memory-distill')).toBeNull()
  })
})
