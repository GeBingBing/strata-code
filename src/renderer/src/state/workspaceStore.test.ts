import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useWorkspaceStore } from './workspaceStore'
import { useConfigStore } from './configStore'
import { useSessionStore } from './sessionStore'
import { useEditorStore } from './editorStore'
import { useSidebarStore } from './sidebarStore'
import { useChatStore } from './chatStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { Workspace, WorkspaceViewState } from '@shared/types'

/** spec: workspace-management AC-1/2/3/4 —— 渲染层 workspace 状态 */

const invokeMock = vi.fn()
const eventListeners = new Map<string, Array<(payload: unknown) => void>>()

function makeApi(): RendererApi {
  eventListeners.clear()
  return {
    invoke: invokeMock as never,
    on: (channel: string, cb: (payload: unknown) => void) => {
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

function resetStores() {
  useChatStore.setState({ status: 'idle', items: [], streamingId: null })
  useSidebarStore.setState({ tab: 'files', collapsed: false })
  useEditorStore.setState({ tabs: [], activePath: null })
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
  useWorkspaceStore.setState({
    workspaces: [],
    openIds: [],
    activeId: null,
    loaded: false,
    load: useWorkspaceStore.getState().load,
    open: useWorkspaceStore.getState().open,
    switch: useWorkspaceStore.getState().switch,
    close: useWorkspaceStore.getState().close,
    updateState: useWorkspaceStore.getState().updateState
  })
}

beforeEach(() => {
  invokeMock.mockReset().mockImplementation(async (channel: string) => {
    if (channel === 'file:list') return []
    if (channel === 'file:read') return { content: '', size: 0, mtime: 0, isBinary: false, isTooLarge: false }
    if (channel === 'sessions:read') return []
    return undefined
  })
  setIpcOverride(makeApi())
  resetStores()
})

describe('workspaceStore', () => {
  it('load 初始化工作区列表', async () => {
    const ws: Workspace = { id: 'w1', path: '/p1', name: 'p1', lastOpenedAt: 1 }
    invokeMock.mockResolvedValueOnce({ workspaces: [ws], openIds: ['w1'], activeId: 'w1' })

    await useWorkspaceStore.getState().load()

    const state = useWorkspaceStore.getState()
    expect(state.workspaces).toEqual([ws])
    expect(state.openIds).toEqual(['w1'])
    expect(state.activeId).toBe('w1')
    expect(state.loaded).toBe(true)
  })

  it('open 打开新工作区并激活', async () => {
    const ws: Workspace = { id: 'w1', path: '/p1', name: 'p1', lastOpenedAt: 1 }
    invokeMock.mockResolvedValueOnce(ws)
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    await useWorkspaceStore.getState().open('/p1')

    expect(useWorkspaceStore.getState().activeId).toBe('w1')
    expect(useWorkspaceStore.getState().openIds).toContain('w1')
    expect(switchWorkspace).toHaveBeenCalledWith('/p1')
  })

  it('switch 保存当前状态并切换', async () => {
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    const b: Workspace = { id: 'b', path: '/b', name: 'b', lastOpenedAt: 2 }
    useWorkspaceStore.setState({ workspaces: [a, b], openIds: ['a', 'b'], activeId: 'a' })
    useSessionStore.setState({ activeId: 's-a' })
    useSidebarStore.setState({ tab: 'sessions' })
    useEditorStore.setState({
      tabs: [{ path: '/a/f.ts', content: '', dirty: false, size: 1, mtime: 1, isBinary: false, isTooLarge: false }],
      activePath: '/a/f.ts'
    })
    useConfigStore.setState({ cwd: '/a' })

    const viewState: WorkspaceViewState = { activeSessionId: 's-b', openFilePaths: ['/b/g.ts'], sidebarTab: 'files' }
    invokeMock
      .mockResolvedValueOnce(undefined) // updateState
      .mockResolvedValueOnce(viewState) // switch
      .mockResolvedValueOnce({ workspaces: [a, b], openIds: ['a', 'b'], activeId: 'b' }) // list

    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    await useWorkspaceStore.getState().switch('b')

    expect(invokeMock).toHaveBeenCalledWith('workspace:updateState', expect.objectContaining({
      id: 'a',
      state: expect.objectContaining({ activeSessionId: 's-a', sidebarTab: 'sessions', openFilePaths: ['/a/f.ts'] })
    }))
    expect(switchWorkspace).toHaveBeenCalledWith('/b')
    expect(useWorkspaceStore.getState().activeId).toBe('b')
  })

  it('close 关闭工作区并切换到下一个', async () => {
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    const b: Workspace = { id: 'b', path: '/b', name: 'b', lastOpenedAt: 2 }
    useWorkspaceStore.setState({ workspaces: [a, b], openIds: ['a', 'b'], activeId: 'a' })

    invokeMock
      .mockResolvedValueOnce({ activeId: 'b' }) // close
      .mockResolvedValueOnce({ workspaces: [a, b], openIds: ['b'], activeId: 'b' }) // list
      .mockResolvedValueOnce({}) // switch state

    await useWorkspaceStore.getState().close('a')

    expect(useWorkspaceStore.getState().activeId).toBe('b')
    expect(useWorkspaceStore.getState().openIds).not.toContain('a')
  })

  it('关闭最后一个工作区且有脏标签时提示确认', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    useWorkspaceStore.setState({ workspaces: [a], openIds: ['a'], activeId: 'a' })
    useEditorStore.setState({
      tabs: [{ path: '/a/f.ts', content: 'x', dirty: true, size: 1, mtime: 1, isBinary: false, isTooLarge: false }],
      activePath: '/a/f.ts'
    })

    await useWorkspaceStore.getState().close('a')

    expect(confirmMock).toHaveBeenCalled()
    expect(useWorkspaceStore.getState().activeId).toBe('a')
    confirmMock.mockRestore()
  })

  /** spec: composer-history AC-5/6 —— collectViewState/restoreViewState 传递 chatInputDraft */
  it('switch 时 collectViewState 包含当前 composerDraft；切换后回写到目标草稿', async () => {
    const a: Workspace = { id: 'a', path: '/a', name: 'a', lastOpenedAt: 1 }
    const b: Workspace = { id: 'b', path: '/b', name: 'b', lastOpenedAt: 2 }
    useWorkspaceStore.setState({ workspaces: [a, b], openIds: ['a', 'b'], activeId: 'a' })
    useChatStore.setState({ composerDraft: '暂存草稿 from a' })
    useConfigStore.setState({ cwd: '/a' })

    const savedBState: WorkspaceViewState = {
      activeSessionId: undefined,
      openFilePaths: [],
      sidebarTab: 'files',
      chatInputDraft: '上次在 b 写了一半'
    }
    invokeMock
      .mockResolvedValueOnce(undefined) // updateState 保存 a 当前
      .mockResolvedValueOnce(savedBState) // switch 返回 b 的 view state
      .mockResolvedValueOnce({ workspaces: [a, b], openIds: ['a', 'b'], activeId: 'b' }) // list

    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    await useWorkspaceStore.getState().switch('b')

    // 保存 a 的状态时把当前草稿传出去
    expect(invokeMock).toHaveBeenCalledWith(
      'workspace:updateState',
      expect.objectContaining({
        id: 'a',
        state: expect.objectContaining({ chatInputDraft: '暂存草稿 from a' })
      })
    )
    // 切换后回写 b 的草稿
    expect(useChatStore.getState().composerDraft).toBe('上次在 b 写了一半')
  })

  it('open 时 restoreViewState 把 chatInputDraft 写回 composerDraft', async () => {
    // 通过直接触发 view state 通路：构造一个已存 chatInputDraft 的 workspace
    const ws: Workspace = { id: 'w1', path: '/p1', name: 'p1', lastOpenedAt: 1 }
    invokeMock.mockResolvedValueOnce(ws)
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    await useWorkspaceStore.getState().open('/p1')

    // open 调用的是 restoreViewState({}) → chatInputDraft undefined → composerDraft 清空
    expect(useChatStore.getState().composerDraft).toBe('')
  })
})
