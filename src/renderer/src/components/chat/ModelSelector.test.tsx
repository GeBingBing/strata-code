import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelSelector } from './ModelSelector'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: app-config —— 模型选择器 */

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

describe('ModelSelector', () => {
  it('渲染当前模型', () => {
    useConfigStore.setState({ model: 'claude-opus-4-8-20251001' })
    render(<ModelSelector />)
    expect((screen.getByTestId('model-selector') as HTMLSelectElement).value).toBe('claude-opus-4-8-20251001')
  })

  it('切换模型时调用 config:set', async () => {
    render(<ModelSelector />)
    fireEvent.change(screen.getByTestId('model-selector'), {
      target: { value: 'claude-sonnet-4-6-20251001' }
    })

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('config:set', {
        model: 'claude-sonnet-4-6-20251001'
      })
    })
    expect(useConfigStore.getState().model).toBe('claude-sonnet-4-6-20251001')
  })

  it('fake 模式下禁用并显示 fake-model', () => {
    useConfigStore.setState({ agentMode: 'fake' })
    render(<ModelSelector />)
    const select = screen.getByTestId('model-selector') as HTMLSelectElement
    expect(select.disabled).toBe(true)
    expect(select.value).toBe('fake-model')
  })

  it('disabled 时禁用选择', () => {
    render(<ModelSelector disabled />)
    expect((screen.getByTestId('model-selector') as HTMLSelectElement).disabled).toBe(true)
  })
})
