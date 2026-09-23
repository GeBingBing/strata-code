import { ChevronRight } from './icons'
import type { SidebarPanel } from '../lib/sidebarRegistry'

interface Props {
  panels: SidebarPanel[]
  active: string
  onChange: (tab: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 是否有未保存的活动 tab */
  hasDirty?: boolean
  /** 当前会话消息数（用于在 sessions 图标显示徽标） */
  itemCount?: number
}

/**
 * Cursor 风格活动栏 —— 从 sidebarRegistry 渲染图标。
 */
export function ActivityBar({
  panels,
  active,
  onChange,
  collapsed,
  onToggleCollapsed,
  hasDirty = false,
  itemCount = 0
}: Props): React.JSX.Element {
  return (
    <nav className="activity-bar" data-testid="activity-bar">
      {panels.map((panel) => {
        const Icon = panel.icon
        return (
          <button
            key={panel.id}
            type="button"
            className={`activity-item ${active === panel.id ? 'active' : ''}`}
            data-testid={`activity-${panel.id}`}
            onClick={() => onChange(panel.id)}
            title={panel.title}
          >
            <Icon className="activity-svg" />
            {panel.id === 'sessions' && itemCount > 0 && (
              <span className="activity-badge">{itemCount}</span>
            )}
            {panel.id === 'files' && hasDirty && <span className="activity-dot" />}
          </button>
        )
      })}
      <div className="activity-spacer" />
      <button
        type="button"
        className="activity-item collapse-btn"
        data-testid="activity-collapse"
        onClick={onToggleCollapsed}
        title={collapsed ? '展开侧栏' : '折叠侧栏'}
      >
        <ChevronRight className={`activity-svg ${collapsed ? 'flip' : ''}`} />
      </button>
    </nav>
  )
}
