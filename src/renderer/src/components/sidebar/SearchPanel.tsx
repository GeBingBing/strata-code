import { useEffect, useState } from 'react'
import { invoke } from '../../ipc/client'
import { useConfigStore } from '../../state/configStore'
import { useEditorStore } from '../../state/editorStore'
import type { FileContent, SearchResult } from '@shared/types'

export function SearchPanel(): React.JSX.Element {
  const cwd = useConfigStore((s) => s.cwd)
  const openEditor = useEditorStore((s) => s.open)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!submitted || !cwd) return
    let cancelled = false
    setLoading(true)
    setError(null)
    invoke('search:files', { path: cwd, query: submitted })
      .then((r) => {
        if (!cancelled) setResults(r as SearchResult[])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [submitted, cwd])

  /** spec: search-navigation AC-1 —— 点击结果打开文件并定位行 */
  const handleOpen = async (r: SearchResult): Promise<void> => {
    try {
      const content = (await invoke('file:read', { path: r.path })) as FileContent
      openEditor(r.path, {
        content: content.content,
        size: content.size,
        mtime: content.mtime,
        isBinary: content.isBinary,
        isTooLarge: content.isTooLarge,
        cursor: { line: r.line }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="sidebar-panel" data-testid="search-panel">
      <div className="panel-search-input">
        <input
          type="search"
          placeholder="在文件中搜索…"
          value={query}
          data-testid="search-input"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSubmitted(query.trim())
          }}
        />
      </div>
      {!cwd && <div className="panel-empty">请先打开工作区</div>}
      {loading && <div className="panel-empty">搜索中…</div>}
      {error && <div className="panel-empty">错误：{error}</div>}
      {!loading && !error && submitted && results.length === 0 && cwd && (
        <div className="panel-empty">无匹配</div>
      )}
      <ul className="search-results">
        {results.map((r) => (
          <li
            key={`${r.path}:${r.line}`}
            className="search-result"
            data-testid={`search-result-${r.path}:${r.line}`}
            onClick={() => void handleOpen(r)}
          >
            <span className="search-result-line">{r.line}</span>
            <span className="search-result-path">{r.path}</span>
            <span className="search-result-preview">{r.preview}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
