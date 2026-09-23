import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from './App'
import { useConfigStore } from './state/configStore'
import { useSessionStore } from './state/sessionStore'
import { useChatStore } from './state/chatStore'
import { useWorkspaceStore } from './state/workspaceStore'
import { setIpcOverride } from './ipc/client'
import type { RendererApi, EventChannel } from '@shared/ipc'

/** spec: workspace-foundation AC-1/4 + workspace-management AC-3/5 —— 启动、欢迎页、设置面板 */

const invokeMock = vi.fn()
const eventListeners = new Map<EventChannel, Array<(payload: unknown) => void>>()

function makeApi(): RendererApi {
  eventListeners.clear()
  return {
    invoke: invokeMock as never,
    on: (channel: EventChannel, cb: (payload: unknown) => void) => {
      const list = eventListeners.get(channel) ?? []
      list.push(cb)
      eventListeners.set(channel, list)
      return () => {
        const updated = eventListeners.get(channel)?.filter((c) => c !== cb) ?? []
        eventListeners.set(channel, updated)
      }
    }
  } as never
}

function emitEvent(channel: EventChannel, payload?: unknown): void {
  eventListeners.get(channel)?.forEach((cb) => cb(payload))
}

function resetStores() {
  useChatStore.setState({
    status: 'idle',
    items: [],
    streamingId: null
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
  useSessionStore.setState({
    sessions: [],
    activeId: null,
    load: async () => {},
    connect: () => () => {},
    open: async () => {},
    rename: async () => {},
    remove: async () => {},
    newChat: () => {}
  })
  useWorkspaceStore.setState({
    workspaces: [],
    openIds: [],
    activeId: null,
    loaded: false,
    load: async () => {},
    open: async () => {},
    switch: async () => {},
    close: async () => {},
    updateState: async () => {}
  })
}

beforeEach(() => {
  invokeMock.mockReset().mockImplementation(async (channel: string) => {
    if (channel === 'file:list') return []
    if (channel === 'file:read') return { content: '', size: 0, mtime: 0, isBinary: false, isTooLarge: false }
    if (channel === 'sessions:read') return []
    if (channel === 'workspace:list') return { workspaces: [], openIds: [], activeId: null }
    if (channel === 'workspace:switch') return {}
    return undefined
  })
  setIpcOverride(makeApi())
  resetStores()
})

describe('App', () => {
  it('无打开工作区且无 cwd 时渲染 WelcomePage', async () => {
    useConfigStore.setState({ cwd: '' })
    useWorkspaceStore.setState({
      loaded: false,
      load: async () => useWorkspaceStore.setState({ loaded: true, openIds: [], activeId: null })
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('welcome-page')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('activity-bar')).not.toBeInTheDocument()
  })

  it('有持久化工作区时渲染 AppShell', async () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: 'w1', path: '/project', name: 'project', lastOpenedAt: 1 }],
      openIds: ['w1'],
      activeId: 'w1',
      loaded: false,
      load: async () => {
        useWorkspaceStore.setState({ loaded: true })
      },
      switch: async () => {
        useConfigStore.setState({ cwd: '/project' })
      }
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('activity-bar')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('welcome-page')).not.toBeInTheDocument()
  })

  it('尚未加载完成时不渲染 WelcomePage/AppShell，避免闪烁', async () => {
    useConfigStore.setState({ loaded: false })
    useWorkspaceStore.setState({ loaded: false })
    render(<App />)
    expect(screen.queryByTestId('welcome-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('activity-bar')).not.toBeInTheDocument()
  })

  it('menu:open-settings 事件打开设置面板', async () => {
    useWorkspaceStore.setState({
      openIds: ['w1'],
      activeId: 'w1',
      loaded: false,
      load: async () => useWorkspaceStore.setState({ loaded: true }),
      switch: async () => useConfigStore.setState({ cwd: '/project' })
    })
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('activity-bar')).toBeInTheDocument())
    emitEvent('menu:open-settings')
    await vi.waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
    })
  })

  it('命令面板 app:open-settings 自定义事件打开设置面板', async () => {
    useWorkspaceStore.setState({
      openIds: ['w1'],
      activeId: 'w1',
      loaded: false,
      load: async () => useWorkspaceStore.setState({ loaded: true }),
      switch: async () => useConfigStore.setState({ cwd: '/project' })
    })
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('activity-bar')).toBeInTheDocument())
    fireEvent(window, new CustomEvent('app:open-settings'))
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
  })
})
