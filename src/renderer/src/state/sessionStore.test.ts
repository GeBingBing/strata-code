import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useSessionStore } from './sessionStore'
import { useConfigStore } from './configStore'
import { useChatStore } from './chatStore'
import { useEditorStore } from './editorStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { SessionSummary } from '@shared/types'

/** spec: workspace-foundation AC-6/7 —— 打开历史会话恢复 cwd */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

function resetStores() {
  useChatStore.setState({ status: 'idle', items: [], streamingId: null })
  useConfigStore.setState({
    cwd: '/current',
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
  useEditorStore.setState({ tabs: [], activePath: null })
  useSessionStore.setState({
    sessions: [],
    activeId: null,
    load: async () => {},
    connect: () => () => {},
    open: useSessionStore.getState().open,
    rename: async () => {},
    remove: async () => {},
    newChat: () => {}
  })
}

beforeEach(() => {
  invokeMock.mockReset().mockImplementation(async (channel: string) => {
    if (channel === 'sessions:read') return []
    if (channel === 'file:list') return []
    return undefined
  })
  setIpcOverride(makeApi())
  resetStores()
})

describe('sessionStore.open', () => {
  it('summary.cwd 与当前 cwd 不同时恢复目标 cwd', async () => {
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    const summary: SessionSummary = {
      id: 's1',
      title: 'Session',
      cwd: '/target',
      createdAt: 1,
      updatedAt: 1
    }
    useSessionStore.setState({ sessions: [summary] })

    await useSessionStore.getState().open('s1')

    expect(switchWorkspace).toHaveBeenCalledWith('/target')
    expect(useSessionStore.getState().activeId).toBe('s1')
  })

  it('summary.cwd 为空时跳过恢复', async () => {
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })

    const summary: SessionSummary = {
      id: 's2',
      title: 'Session',
      cwd: '',
      createdAt: 1,
      updatedAt: 1
    }
    useSessionStore.setState({ sessions: [summary] })

    await useSessionStore.getState().open('s2')

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(useSessionStore.getState().activeId).toBe('s2')
  })

  it('cwd 相同时不重复切换', async () => {
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ cwd: '/same', switchWorkspace })

    const summary: SessionSummary = {
      id: 's3',
      title: 'Session',
      cwd: '/same',
      createdAt: 1,
      updatedAt: 1
    }
    useSessionStore.setState({ sessions: [summary] })

    await useSessionStore.getState().open('s3')

    expect(switchWorkspace).not.toHaveBeenCalled()
  })

  it('存在脏标签且 cwd 变化时提示确认', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })
    useEditorStore.setState({
      tabs: [{ path: '/current/a.ts', content: 'x', dirty: true, size: 1, mtime: 1, isBinary: false, isTooLarge: false }],
      activePath: '/current/a.ts'
    })

    const summary: SessionSummary = {
      id: 's4',
      title: 'Session',
      cwd: '/target',
      createdAt: 1,
      updatedAt: 1
    }
    useSessionStore.setState({ sessions: [summary] })

    await useSessionStore.getState().open('s4')

    expect(confirmMock).toHaveBeenCalled()
    expect(switchWorkspace).toHaveBeenCalledWith('/target')
    confirmMock.mockRestore()
  })

  it('用户取消确认时不切换 cwd 也不打开会话', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const switchWorkspace = vi.fn()
    useConfigStore.setState({ switchWorkspace })
    useEditorStore.setState({
      tabs: [{ path: '/current/a.ts', content: 'x', dirty: true, size: 1, mtime: 1, isBinary: false, isTooLarge: false }],
      activePath: '/current/a.ts'
    })

    const summary: SessionSummary = {
      id: 's5',
      title: 'Session',
      cwd: '/target',
      createdAt: 1,
      updatedAt: 1
    }
    useSessionStore.setState({ sessions: [summary] })

    await useSessionStore.getState().open('s5')

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(useSessionStore.getState().activeId).toBeNull()
    confirmMock.mockRestore()
  })
})
