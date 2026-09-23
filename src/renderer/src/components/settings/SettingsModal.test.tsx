import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: workspace-foundation AC-4/5 —— 设置面板 */

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
    cwd: '/project',
    permissionMode: 'default',
    model: 'default',
    agentMode: 'real',
    loaded: true,
    editor: { wordWrap: false, minimap: false, fontSize: 13, theme: 'vs-dark' },
    load: async () => {},
    pickWorkspace: async () => {},
    switchWorkspace: async () => {},
    removeRecent: () => {},
    setPermissionMode: async () => {},
    setModel: async () => {},
    setTheme: () => {},
    toggleWordWrap: () => {},
    toggleMinimap: () => {},
    setFontSize: () => {}
  })
})

describe('SettingsModal', () => {
  it('open=false 时不渲染', () => {
    render(<SettingsModal open={false} onClose={() => {}} />)
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
  })

  it('open=true 时渲染编辑器与 Agent 设置', () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
    expect(screen.getByTestId('settings-editor')).toBeInTheDocument()
    expect(screen.getByTestId('settings-agent')).toBeInTheDocument()
    expect(screen.getByTestId('settings-about')).toBeInTheDocument()
  })

  it('切换主题触发 setTheme', () => {
    const setTheme = vi.fn()
    useConfigStore.setState({ setTheme })
    render(<SettingsModal open={true} onClose={() => {}} />)
    fireEvent.change(screen.getByTestId('settings-theme'), { target: { value: 'vs' } })
    expect(setTheme).toHaveBeenCalledWith('vs')
  })

  it('修改字体大小触发 setFontSize', () => {
    const setFontSize = vi.fn()
    useConfigStore.setState({ setFontSize })
    render(<SettingsModal open={true} onClose={() => {}} />)
    fireEvent.change(screen.getByTestId('settings-font-size'), { target: { value: '16' } })
    expect(setFontSize).toHaveBeenCalledWith(16)
  })

  it('点击关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    render(<SettingsModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalled()
  })
})
