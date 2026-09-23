import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkspaceTabs } from './WorkspaceTabs'
import { useWorkspaceStore } from '../../state/workspaceStore'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { Workspace } from '@shared/types'

/** spec: workspace-management AC-2/3 —— 工作区标签栏 */

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
  useWorkspaceStore.setState({
    workspaces: [],
    openIds: [],
    activeId: null,
    loaded: true,
    load: async () => {},
    open: async () => {},
    switch: async () => {},
    close: async () => {},
    updateState: async () => {}
  })
  useConfigStore.setState({
    cwd: '',
    permissionMode: 'default',
    model: 'default',
    agentMode: 'real',
    loaded: true,
    editor: { wordWrap: false, minimap: false, fontSize: 13, theme: 'vs-dark' },
    recentWorkspaces: [],
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

describe('WorkspaceTabs', () => {
  it('无打开工作区时不渲染', () => {
    render(<WorkspaceTabs />)
    expect(screen.queryByTestId('workspace-tabs')).not.toBeInTheDocument()
  })

  it('渲染已打开工作区标签', () => {
    const ws: Workspace = { id: 'w1', path: '/project-a', name: 'project-a', lastOpenedAt: 1 }
    useWorkspaceStore.setState({ workspaces: [ws], openIds: ['w1'], activeId: 'w1' })
    render(<WorkspaceTabs />)
    expect(screen.getByTestId('workspace-tab-w1')).toBeInTheDocument()
    expect(screen.getByText('project-a')).toBeInTheDocument()
  })

  it('点击标签切换工作区', async () => {
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    const b: Workspace = { id: 'b', path: '/b', name: 'b', lastOpenedAt: 2 }
    const switchFn = vi.fn()
    useWorkspaceStore.setState({
      workspaces: [a, b],
      openIds: ['a', 'b'],
      activeId: 'a',
      switch: switchFn
    })
    render(<WorkspaceTabs />)
    fireEvent.click(screen.getByTestId('workspace-tab-b'))
    await vi.waitFor(() => expect(switchFn).toHaveBeenCalledWith('b'))
  })

  it('点击关闭按钮关闭工作区', async () => {
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    const closeFn = vi.fn()
    useWorkspaceStore.setState({
      workspaces: [a],
      openIds: ['a'],
      activeId: 'a',
      close: closeFn
    })
    render(<WorkspaceTabs />)
    fireEvent.click(screen.getByTestId('workspace-close-a'))
    await vi.waitFor(() => expect(closeFn).toHaveBeenCalledWith('a'))
  })

  it('点击 + 打开新工作区', async () => {
    const ws: Workspace = { id: 'w1', path: '/project-a', name: 'project-a', lastOpenedAt: 1 }
    const pickWorkspace = vi.fn().mockImplementation(() => {
      useConfigStore.setState({ cwd: '/new' })
    })
    const openFn = vi.fn()
    useConfigStore.setState({ pickWorkspace })
    useWorkspaceStore.setState({ workspaces: [ws], openIds: ['w1'], activeId: 'w1', open: openFn })

    render(<WorkspaceTabs />)
    fireEvent.click(screen.getByTestId('workspace-add'))
    await vi.waitFor(() => {
      expect(pickWorkspace).toHaveBeenCalled()
      expect(openFn).toHaveBeenCalledWith('/new')
    })
  })
})
