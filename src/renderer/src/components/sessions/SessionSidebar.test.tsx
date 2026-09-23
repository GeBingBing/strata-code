import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionSidebar } from './SessionSidebar'
import { useSessionStore } from '../../state/sessionStore'
import { useWorkspaceStore } from '../../state/workspaceStore'
import { useChatStore } from '../../state/chatStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { SessionSummary } from '@shared/types'

/** spec: session-search-and-grouping */

function makeApi(): RendererApi {
  return {
    invoke: vi.fn().mockResolvedValue(undefined),
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  setIpcOverride(makeApi())
  useChatStore.setState({
    status: 'idle',
    items: [],
    streamingId: null
  })
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
})

describe('SessionSidebar', () => {
  it('渲染搜索框与会话列表', () => {
    const now = Date.now()
    useSessionStore.setState({
      sessions: [
        { id: 's1', title: 'first', cwd: '/', createdAt: now, updatedAt: now }
      ],
      activeId: null
    })
    render(<SessionSidebar />)
    expect(screen.getByTestId('session-search')).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()
  })

  it('搜索过滤会话', () => {
    const now = Date.now()
    useSessionStore.setState({
      sessions: [
        { id: 's1', title: 'hello world', cwd: '/', createdAt: now, updatedAt: now },
        { id: 's2', title: 'other', cwd: '/', createdAt: now, updatedAt: now }
      ],
      activeId: null
    })
    render(<SessionSidebar />)
    fireEvent.change(screen.getByTestId('session-search'), { target: { value: 'hello' } })
    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(screen.queryByText('other')).not.toBeInTheDocument()
  })

  it('按今天/昨天/更早分组', () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
    const twoDaysAgo = yesterdayStart - 24 * 60 * 60 * 1000

    useSessionStore.setState({
      sessions: [
        { id: 's1', title: 'today', cwd: '/', createdAt: todayStart + 1000, updatedAt: todayStart + 1000 },
        { id: 's2', title: 'yesterday', cwd: '/', createdAt: yesterdayStart + 1000, updatedAt: yesterdayStart + 1000 },
        { id: 's3', title: 'earlier', cwd: '/', createdAt: twoDaysAgo, updatedAt: twoDaysAgo }
      ],
      activeId: null
    })

    render(<SessionSidebar />)
    expect(screen.getByTestId('group-今天')).toBeInTheDocument()
    expect(screen.getByTestId('group-昨天')).toBeInTheDocument()
    expect(screen.getByTestId('group-更早')).toBeInTheDocument()
  })

  it('只显示当前活跃工作区 cwd 的会话', () => {
    const projectA: SessionSummary = { id: 's1', title: 'A chat', cwd: '/project-a', createdAt: 1, updatedAt: 1 }
    const projectB: SessionSummary = { id: 's2', title: 'B chat', cwd: '/project-b', createdAt: 1, updatedAt: 1 }

    useSessionStore.setState({ sessions: [projectA, projectB] })
    useWorkspaceStore.setState({
      workspaces: [
        { id: 'wa', path: '/project-a', name: 'project-a', lastOpenedAt: 1 },
        { id: 'wb', path: '/project-b', name: 'project-b', lastOpenedAt: 1 }
      ],
      activeId: 'wa'
    })

    render(<SessionSidebar />)
    expect(screen.getByText('A chat')).toBeInTheDocument()
    expect(screen.queryByText('B chat')).not.toBeInTheDocument()
  })

  it('无活跃工作区时显示全部会话', () => {
    const projectA: SessionSummary = { id: 's1', title: 'A chat', cwd: '/project-a', createdAt: 1, updatedAt: 1 }
    const projectB: SessionSummary = { id: 's2', title: 'B chat', cwd: '/project-b', createdAt: 1, updatedAt: 1 }

    useSessionStore.setState({ sessions: [projectA, projectB] })
    render(<SessionSidebar />)
    expect(screen.getByText('A chat')).toBeInTheDocument()
    expect(screen.getByText('B chat')).toBeInTheDocument()
  })
})
