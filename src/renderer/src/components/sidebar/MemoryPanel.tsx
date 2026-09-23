import { useEffect, useState } from 'react'
import { invoke } from '../../ipc/client'
import { useConfigStore } from '../../state/configStore'
import type { MemoryEntry } from '@shared/types'

export function MemoryPanel(): React.JSX.Element {
  const cwd = useConfigStore((s) => s.cwd)
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = (): void => {
    invoke('memory:list', undefined as never)
      .then((r) => setEntries(r as MemoryEntry[]))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(load, [])

  const remove = async (id: string): Promise<void> => {
    if (!window.confirm('确认删除该记忆？')) return
    try {
      await invoke('memory:delete', { id })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const projectEntries = cwd ? entries.filter((e) => e.scope === 'project' && e.cwd === cwd) : []
  const globalEntries = entries.filter((e) => e.scope === 'global')

  return (
    <div className="sidebar-panel" data-testid="memory-panel">
      {error && <div className="panel-empty">错误：{error}</div>}

      <div className="memory-section">
        <h4 className="git-section-title">项目记忆 ({projectEntries.length})</h4>
        <ul className="memory-list">
          {projectEntries.map((e) => (
            <li key={e.id} className="memory-item" data-testid={`memory-item-${e.id}`}>
              <span className="memory-kind">{e.kind}</span>
              <span className="memory-content">{e.content}</span>
              <button type="button" className="memory-remove" onClick={() => void remove(e.id)} aria-label="删除">
                ×
              </button>
            </li>
          ))}
          {projectEntries.length === 0 && <li className="panel-empty">无</li>}
        </ul>
      </div>

      <div className="memory-section">
        <h4 className="git-section-title">全局记忆 ({globalEntries.length})</h4>
        <ul className="memory-list">
          {globalEntries.map((e) => (
            <li key={e.id} className="memory-item" data-testid={`memory-item-${e.id}`}>
              <span className="memory-kind">{e.kind}</span>
              <span className="memory-content">{e.content}</span>
              <button type="button" className="memory-remove" onClick={() => void remove(e.id)} aria-label="删除">
                ×
              </button>
            </li>
          ))}
          {globalEntries.length === 0 && <li className="panel-empty">无</li>}
        </ul>
      </div>
    </div>
  )
}
