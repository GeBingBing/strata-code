import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useConfigStore } from './configStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: app-config —— ConfigStore 状态与 IPC */

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
  useConfigStore.setState({
    cwd: '',
    permissionMode: 'default',
    model: 'default',
    agentMode: 'real',
    loaded: false,
    load: useConfigStore.getState().load,
    pickWorkspace: useConfigStore.getState().pickWorkspace,
    setPermissionMode: useConfigStore.getState().setPermissionMode,
    setModel: useConfigStore.getState().setModel
  })
})

describe('configStore', () => {
  it('load: 从 config:get 初始化状态', async () => {
    invokeMock.mockResolvedValueOnce({
      cwd: '/project',
      permissionMode: 'acceptEdits',
      model: 'claude-sonnet-4-6-20251001',
      agentMode: 'fake'
    })

    await useConfigStore.getState().load()

    const state = useConfigStore.getState()
    expect(state.cwd).toBe('/project')
    expect(state.permissionMode).toBe('acceptEdits')
    expect(state.model).toBe('claude-sonnet-4-6-20251001')
    expect(state.agentMode).toBe('fake')
    expect(state.loaded).toBe(true)
  })

  it('pickWorkspace: 调用 workspace:pick 并更新 cwd', async () => {
    invokeMock.mockResolvedValueOnce('/new/project')

    await useConfigStore.getState().pickWorkspace()

    expect(invokeMock).toHaveBeenCalledWith('workspace:pick')
    expect(invokeMock).toHaveBeenCalledWith('config:set', { cwd: '/new/project' })
    expect(useConfigStore.getState().cwd).toBe('/new/project')
  })

  it('pickWorkspace: 用户取消时不更新 cwd', async () => {
    invokeMock.mockResolvedValueOnce(null)

    await useConfigStore.getState().pickWorkspace()

    expect(invokeMock).toHaveBeenCalledWith('workspace:pick')
    expect(invokeMock).not.toHaveBeenCalledWith('config:set', expect.anything())
    expect(useConfigStore.getState().cwd).toBe('')
  })

  it('setPermissionMode: 调用 agent:setPermissionMode 并更新状态', async () => {
    await useConfigStore.getState().setPermissionMode('plan')

    expect(invokeMock).toHaveBeenCalledWith('agent:setPermissionMode', { mode: 'plan' })
    expect(useConfigStore.getState().permissionMode).toBe('plan')
  })

  it('setModel: 调用 config:set 并更新状态', async () => {
    await useConfigStore.getState().setModel('claude-opus-4-8-20251001')

    expect(invokeMock).toHaveBeenCalledWith('config:set', { model: 'claude-opus-4-8-20251001' })
    expect(useConfigStore.getState().model).toBe('claude-opus-4-8-20251001')
  })
})
