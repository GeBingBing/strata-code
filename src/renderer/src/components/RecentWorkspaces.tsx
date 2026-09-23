import { useState } from 'react'
import { useConfigStore } from '../state/configStore'

/**
 * 最近工作区列表 —— 显示在侧栏顶部（仅在 Files 视图下）。
 * 单击切换 cwd；悬停出现 ✕ 按钮移除记录。
 */
export function RecentWorkspaces(): React.JSX.Element | null {
  const recent = useConfigStore((s) => s.recentWorkspaces)
  const cwd = useConfigStore((s) => s.cwd)
  const switchWorkspace = useConfigStore((s) => s.switchWorkspace)
  const removeRecent = useConfigStore((s) => s.removeRecent)
  const pickWorkspace = useConfigStore((s) => s.pickWorkspace)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (recent.length === 0) return null

  const basename = (p: string): string => p.split('/').filter(Boolean).pop() ?? p

  const handleSwitch = async (path: string): Promise<void> => {
    if (path === cwd || busy) return
    setBusy(path)
    setError(null)
    try {
      await switchWorkspace(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="recent-workspaces" data-testid="recent-workspaces">
      <div className="recent-header">
        <span>Recent</span>
        <button
          type="button"
          className="recent-add"
          data-testid="recent-add"
          onClick={() => void pickWorkspace()}
          title="打开其他工作目录…"
        >
          +
        </button>
      </div>
      <ul>
        {recent.map((p) => (
          <li
            key={p}
            className={`recent-item ${p === cwd ? 'active' : ''}`}
            data-testid={`recent-${p}`}
          >
            <button
              type="button"
              className="recent-button"
              onClick={() => void handleSwitch(p)}
              disabled={busy !== null}
              title={p}
            >
              <span className="recent-name">{basename(p)}</span>
              <span className="recent-path">{p.replace(/^.*\//, '…/')}</span>
            </button>
            <button
              type="button"
              className="recent-remove"
              data-testid={`recent-remove-${p}`}
              onClick={(e) => {
                e.stopPropagation()
                removeRecent(p)
              }}
              title="从最近列表移除"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {error && <div className="recent-error" data-testid="recent-error">{error}</div>}
    </div>
  )
}