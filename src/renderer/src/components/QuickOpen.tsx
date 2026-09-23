import { useEffect, useState } from 'react'
import type { FileNode } from '@shared/types'
import { invoke } from '../ipc/client'
import { useConfigStore } from '../state/configStore'
import { useEditorStore } from '../state/editorStore'
import { FileIcon } from './icons'

interface Props {
  open: boolean
  onClose: () => void
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = []
  const walk = (list: FileNode[]): void => {
    for (const n of list) {
      out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function fuzzyScore(target: string, query: string): number {
  const t = target.toLowerCase()
  const q = query.toLowerCase()
  if (!q) return 1
  let ti = 0
  let qi = 0
  let score = 0
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      score += 1
      ti++
      qi++
    } else {
      ti++
    }
  }
  return qi === q.length ? score / t.length : 0
}

export function QuickOpen({ open, onClose }: Props): React.JSX.Element | null {
  const cwd = useConfigStore((s) => s.cwd)
  const openEditor = useEditorStore((s) => s.open)
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileNode[]>([])
  const [selected, setSelected] = useState(0)
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    if (!open || !cwd) return
    setQuery('')
    setSelected(0)
    setPreview('')
    void invoke('file:list', { path: cwd, depth: 10 })
      .then((res) => setFiles(flattenTree(res as FileNode[])))
      .catch(() => setFiles([]))
  }, [open, cwd])

  const filtered = query
    ? files
        .filter((f) => !f.isDirectory)
        .map((f) => ({ file: f, score: Math.max(fuzzyScore(f.name, query), fuzzyScore(f.path, query)) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.file)
        .slice(0, 10)
    : files.filter((f) => !f.isDirectory).slice(0, 10)

  useEffect(() => {
    const f = filtered[selected]
    if (!f) {
      setPreview('')
      return
    }
    void invoke('file:read', { path: f.path })
      .then((c) => {
        const r = c as { content: string; isBinary: boolean; isTooLarge: boolean }
        if (r.isBinary) setPreview('[二进制文件，无法预览]')
        else if (r.isTooLarge) setPreview('[文件过大，无法预览]')
        else setPreview(r.content.split('\n').slice(0, 8).join('\n'))
      })
      .catch(() => setPreview(''))
  }, [selected, query, files])

  if (!open) return null

  const choose = (idx: number): void => {
    const f = filtered[idx]
    if (!f) return
    void invoke('file:read', { path: f.path }).then((c) => {
      const r = c as { content: string; size: number; mtime: number; isBinary: boolean; isTooLarge: boolean }
      openEditor(f.path, {
        content: r.content,
        size: r.size,
        mtime: r.mtime,
        isBinary: r.isBinary,
        isTooLarge: r.isTooLarge
      })
      onClose()
    })
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(selected)
    }
  }

  return (
    <div className="modal-overlay" data-testid="quick-open" role="dialog">
      <div className="quick-open">
        <input
          autoFocus
          type="text"
          placeholder="按文件名搜索…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={onKey}
          data-testid="quick-open-input"
        />
        <div className="quick-open-body">
          <ul>
            {filtered.length === 0 && <li className="quick-open-empty">无匹配文件</li>}
            {filtered.map((f, i) => (
              <li
                key={f.path}
                className={i === selected ? 'selected' : ''}
                data-testid={`quick-open-${f.path}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => choose(i)}
              >
                <span><FileIcon size={14} /> {f.name}</span>
                <span className="quick-open-path">{f.path.replace(cwd + '/', '')}</span>
              </li>
            ))}
          </ul>
          <pre className="quick-open-preview">{preview}</pre>
        </div>
      </div>
    </div>
  )
}