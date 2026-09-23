import { useState } from 'react'
import { useSessionStore } from '../../state/sessionStore'
import { useChatStore } from '../../state/chatStore'
import { useWorkspaceStore } from '../../state/workspaceStore'
import type { SessionSummary } from '@shared/types'

function groupByDate(sessions: SessionSummary[]): {
  today: SessionSummary[]
  yesterday: SessionSummary[]
  earlier: SessionSummary[]
} {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  return sessions.reduce(
    (acc, s) => {
      if (s.updatedAt >= todayStart) acc.today.push(s)
      else if (s.updatedAt >= yesterdayStart) acc.yesterday.push(s)
      else acc.earlier.push(s)
      return acc
    },
    { today: [] as SessionSummary[], yesterday: [] as SessionSummary[], earlier: [] as SessionSummary[] }
  )
}

export function SessionSidebar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeId = useSessionStore((s) => s.activeId)
  const open = useSessionStore((s) => s.open)
  const remove = useSessionStore((s) => s.remove)
  const newChat = useSessionStore((s) => s.newChat)
  const status = useChatStore((s) => s.status)
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeId)
  )
  const [query, setQuery] = useState('')

  const workspaceSessions = activeWorkspace
    ? sessions.filter((s) => s.cwd === activeWorkspace.path)
    : sessions
  const filtered = workspaceSessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
  const grouped = groupByDate(filtered)

  const renderGroup = (label: string, items: SessionSummary[]) => {
    if (items.length === 0) return null
    return (
      <li key={label} className="session-group">
        <div className="session-group-label" data-testid={`group-${label}`}>
          {label}
        </div>
        <ul>
          {items.map((session) => (
            <li key={session.id} className={session.id === activeId ? 'active' : ''}>
              <button type="button" className="session-item" onClick={() => void open(session.id)}>
                <span className="session-title">{session.title}</span>
              </button>
              <button
                type="button"
                className="session-delete"
                aria-label={`删除 ${session.title}`}
                onClick={() => void remove(session.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </li>
    )
  }

  return (
    <nav className="session-sidebar" data-testid="session-sidebar">
      <button
        type="button"
        className="btn new-chat"
        data-testid="new-chat"
        onClick={() => newChat()}
        disabled={status === 'running'}
      >
        ＋ 新对话
      </button>
      <input
        type="search"
        className="session-search"
        data-testid="session-search"
        placeholder="搜索会话…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="session-list">
        {renderGroup('今天', grouped.today)}
        {renderGroup('昨天', grouped.yesterday)}
        {renderGroup('更早', grouped.earlier)}
        {filtered.length === 0 && (
          <li className="session-empty">无匹配会话</li>
        )}
      </ul>
    </nav>
  )
}
