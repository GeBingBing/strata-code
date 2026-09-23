import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PermissionModeSelector } from './PermissionModeSelector'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: app-config —— 权限模式选择器 */

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
    loaded: true,
    load: useConfigStore.getState().load,
    pickWorkspace: useConfigStore.getState().pickWorkspace,
    setPermissionMode: useConfigStore.getState().setPermissionMode,
    setModel: useConfigStore.getState().setModel
  })
})

describe('PermissionModeSelector', () => {
  it('渲染当前权限模式', () => {
    render(<PermissionModeSelector />)
    expect((screen.getByTestId('permission-mode-selector') as HTMLSelectElement).value).toBe('default')
  })

  it('切换权限模式时调用 agent:setPermissionMode', async () => {
    render(<PermissionModeSelector />)
    fireEvent.change(screen.getByTestId('permission-mode-selector'), {
      target: { value: 'acceptEdits' }
    })

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('agent:setPermissionMode', { mode: 'acceptEdits' })
    })
    expect(useConfigStore.getState().permissionMode).toBe('acceptEdits')
  })

  it('disabled 时禁用选择', () => {
    render(<PermissionModeSelector disabled />)
    expect((screen.getByTestId('permission-mode-selector') as HTMLSelectElement).disabled).toBe(true)
  })
})
