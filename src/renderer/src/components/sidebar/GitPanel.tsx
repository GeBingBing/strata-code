import { useEffect, useState } from 'react'
import { invoke } from '../../ipc/client'
import { useConfigStore } from '../../state/configStore'
import type { GitStatus, GitCommit } from '@shared/types'

export function GitPanel(): React.JSX.Element {
  const cwd = useConfigStore((s) => s.cwd)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!cwd) return
    let cancelled = false
    Promise.all([
      invoke('git:status', { path: cwd }) as Promise<GitStatus>,
      invoke('git:log', { path: cwd, limit: 10 }) as Promise<GitCommit[]>
    ])
      .then(([s, l]) => {
        if (!cancelled) {
          setStatus(s)
          setCommits(l)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [cwd])

  const loadDiff = async (file: string): Promise<void> => {
    if (!cwd) return
    if (diffs[file]) {
      setExpandedFile(expandedFile === file ? null : file)
      return
    }
    try {
      const diff = (await invoke('git:diff', { path: cwd, file })) as string
      setDiffs({ ...diffs, [file]: diff })
      setExpandedFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!cwd) return <div className="panel-empty" data-testid="git-panel">请先打开工作区</div>

  return (
    <div className="sidebar-panel" data-testid="git-panel">
      {error && <div className="panel-empty">错误：{error}</div>}
      {status && (
        <>
          <div className="git-branch" data-testid="git-branch">
            ⎇ {status.branch || 'detached'}
          </div>
          {status.files.length === 0 ? (
            <div className="panel-empty">工作区干净</div>
          ) : (
            <ul className="git-files">
              {status.files.map((f) => (
                <li key={f.path} className="git-file" data-testid={`git-file-${f.path}`}>
                  <button
                    type="button"
                    className="git-file-btn"
                    onClick={() => void loadDiff(f.path)}
                  >
                    <span className={`git-status-${f.status.toLowerCase()}`}>{f.status}</span>
                    <span className="git-file-path">{f.path}</span>
                  </button>
                  {expandedFile === f.path && (
                    <pre className="git-diff" data-testid={`git-diff-${f.path}`}>
                      {diffs[f.path] || '(no diff)'}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="git-log-section">
            <h4 className="git-section-title">最近提交</h4>
            <ul className="git-commits">
              {commits.map((c) => (
                <li key={c.sha} className="git-commit" data-testid={`git-commit-${c.sha}`}>
                  <span className="git-commit-sha">{c.sha}</span>
                  <span className="git-commit-message">{c.message}</span>
                </li>
              ))}
              {commits.length === 0 && <li className="panel-empty">暂无提交</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
