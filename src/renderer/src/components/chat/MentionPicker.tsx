import { useEffect, useMemo, useState } from 'react'
import { invoke } from '../../ipc/client'
import type { FileNode, MentionAttachment } from '@shared/types'
import { FileIcon, FolderIcon } from '../icons'

interface Props {
  query: string
  onSelect: (attachment: MentionAttachment) => void
  onClose: () => void
}

interface MentionItem {
  type: 'file' | 'folder'
  path: string
  label: string
}

function flatten(nodes: FileNode[], prefix = ''): MentionItem[] {
  const out: MentionItem[] = []
  for (const n of nodes) {
    const label = prefix ? `${prefix}/${n.name}` : n.name
    if (n.isDirectory) {
      out.push({ type: 'folder', path: n.path, label })
      if (n.children) out.push(...flatten(n.children, label))
    } else {
      out.push({ type: 'file', path: n.path, label })
    }
  }
  return out
}

export function filterMentions(items: MentionItem[], query: string): MentionItem[] {
  const q = query.toLowerCase()
  return items
    .filter((it) => it.label.toLowerCase().includes(q))
    .slice(0, 50)
}

export function MentionPicker({ query, onSelect, onClose }: Props): React.JSX.Element {
  const [items, setItems] = useState<MentionItem[]>([])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load(): Promise<void> {
      try {
        const tree = await invoke('file:list', { path: '', depth: 10 })
        if (!mounted) return
        setItems(flatten(tree))
      } catch {
        if (mounted) setItems([])
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => filterMentions(items, query), [items, query])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        pick(filtered[selected])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, selected, onClose])

  function pick(item: MentionItem): void {
    onSelect({
      type: item.type,
      id: `${item.type}:${item.path}`,
      path: item.path,
      label: item.label
    })
  }

  if (filtered.length === 0) {
    return (
      <div className="mention-picker" data-testid="mention-picker">
        <div className="mention-empty">无匹配文件</div>
      </div>
    )
  }

  return (
    <div className="mention-picker" data-testid="mention-picker">
      {filtered.map((it, i) => (
        <div
          key={it.path}
          className={`mention-item ${i === selected ? 'selected' : ''}`}
          data-testid={`mention-item-${it.path}`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => pick(it)}
        >
          <span className="mention-icon">
            {it.type === 'folder' ? <FolderIcon size={14} /> : <FileIcon size={14} />}
          </span>
          <span className="mention-label">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
