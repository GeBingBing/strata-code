import { useEffect, useState } from 'react'
import type { Command } from '../lib/commands'
import { getCommands, subscribeCommands } from '../lib/commands'

interface Props {
  open: boolean
  onClose: () => void
}

/** 简单 fuzzy 匹配：query 字符按顺序在 target 中出现即命中，按出现密度打分 */
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

export function CommandPalette({ open, onClose }: Props): React.JSX.Element | null {
  const [commands, setCommands] = useState<Command[]>(getCommands())
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const off = subscribeCommands(() => setCommands(getCommands()))
    return () => {
      off()
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
    }
  }, [open])

  if (!open) return null

  const filtered = query
    ? commands
        .map((c) => ({ cmd: c, score: Math.max(fuzzyScore(c.label, query), fuzzyScore(c.id, query)) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.cmd)
    : commands

  const run = async (cmd: Command): Promise<void> => {
    onClose()
    try {
      await cmd.action()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('command failed:', err)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      void run(filtered[selected])
    }
  }

  return (
    <div className="modal-overlay" data-testid="command-palette" role="dialog">
      <div className="command-palette">
        <input
          autoFocus
          type="text"
          placeholder="输入命令…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
          data-testid="command-palette-input"
        />
        <ul>
          {filtered.length === 0 && <li className="command-empty">无匹配命令</li>}
          {filtered.map((c, i) => (
            <li
              key={c.id}
              className={i === selected ? 'selected' : ''}
              data-testid={`command-${c.id}`}
              onClick={() => void run(c)}
              onMouseEnter={() => setSelected(i)}
            >
              <div className="command-label">{c.label}</div>
              {c.description && <div className="command-desc">{c.description}</div>}
              {c.shortcut && <div className="command-shortcut">{c.shortcut}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}