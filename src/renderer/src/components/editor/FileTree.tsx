import { useEffect, useState } from 'react'
import type { FileNode } from '@shared/types'
import { invoke } from '../../ipc/client'
import { useConfigStore } from '../../state/configStore'
import { useEditorStore } from '../../state/editorStore'
import { ContextMenu, type ContextMenuAction } from '../ContextMenu'
import { FileIcon, FolderIcon, FolderOpenIcon } from '../icons'

interface MenuState {
  x: number
  y: number
  actions: ContextMenuAction[]
}

function TreeNode({
  node,
  depth,
  onOpen,
  onContextMenu,
  refresh
}: {
  node: FileNode
  depth: number
  onOpen: (path: string) => void
  onContextMenu: (e: React.MouseEvent, n: FileNode) => void
  refresh: () => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1)
  const [children, setChildren] = useState<FileNode[] | null>(node.children ?? null)

  const loadChildren = (): void => {
    void invoke('file:list', { path: node.path, depth: 1 }).then((res) => {
      setChildren(res as FileNode[])
    })
  }

  useEffect(() => {
    if (expanded && children === null && node.isDirectory) {
      loadChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, node])

  if (!node.isDirectory) {
    return (
      <div
        className="tree-leaf"
        data-testid={`file-${node.path}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onOpen(node.path)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <FileIcon size={14} /> {node.name}
      </div>
    )
  }

  return (
    <div>
      <div
        className="tree-dir"
        data-testid={`dir-${node.path}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => setExpanded((v) => !v)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {expanded ? <FolderOpenIcon size={14} /> : <FolderIcon size={14} />} {node.name}
      </div>
      {expanded && children && (
        <div>
          {children.map((c) => (
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              refresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree(): React.JSX.Element {
  const cwd = useConfigStore((s) => s.cwd)
  const loaded = useConfigStore((s) => s.loaded)
  const open = useEditorStore((s) => s.open)
  const [root, setRoot] = useState<FileNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [tick, setTick] = useState(0) // 用于触发子树刷新

  const refresh = (): void => setTick((t) => t + 1)

  useEffect(() => {
    if (!loaded || !cwd) return
    void invoke('file:list', { path: cwd, depth: 1 })
      .then((res) => {
        setRoot(res as FileNode[])
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [cwd, loaded, tick])

  const handleOpen = async (path: string): Promise<void> => {
    try {
      const result = await invoke('file:read', { path })
      const r = result as { content: string; size: number; mtime: number; isBinary: boolean; isTooLarge: boolean }
      open(path, {
        content: r.content,
        size: r.size,
        mtime: r.mtime,
        isBinary: r.isBinary,
        isTooLarge: r.isTooLarge
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('open file failed:', err)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, node: FileNode): void => {
    e.preventDefault()
    const dir = node.isDirectory ? node.path : node.path.replace(/\/[^/]+$/, '')

    const actions: ContextMenuAction[] = node.isDirectory
      ? [
          {
            id: 'newFile',
            label: '新建文件…',
            prompt: { label: '文件名', placeholder: 'untitled.ts' },
            action: async (name) => {
              if (!name) return
              const path = `${dir}/${name}`
              await invoke('file:create', { path, content: '' })
              refresh()
            }
          },
          {
            id: 'newDir',
            label: '新建目录…',
            prompt: { label: '目录名', placeholder: 'new-folder' },
            action: async (name) => {
              if (!name) return
              const path = `${dir}/${name}`
              await invoke('file:mkdir', { path })
              refresh()
            }
          },
          { id: 'divider1', label: '——', disabled: true, action: async () => {} },
          {
            id: 'rename',
            label: '重命名…',
            prompt: { label: '新名称', defaultValue: node.name },
            action: async (newName) => {
              if (!newName || newName === node.name) return
              const parent = node.path.replace(new RegExp(`/${node.name}$`), '')
              const to = `${parent}/${newName}`
              await invoke('file:rename', { from: node.path, to })
              refresh()
            }
          },
          {
            id: 'copyPath',
            label: '复制路径',
            action: async () => {
              await navigator.clipboard.writeText(node.path)
            }
          },
          {
            id: 'delete',
            label: '删除目录',
            destructive: true,
            action: async () => {
              if (!window.confirm(`确认删除目录 ${node.name}？\n${node.path}`)) return
              await invoke('file:delete', { path: node.path })
              refresh()
            }
          }
        ]
      : [
          {
            id: 'rename',
            label: '重命名…',
            prompt: { label: '新名称', defaultValue: node.name },
            action: async (newName) => {
              if (!newName || newName === node.name) return
              const parent = node.path.replace(new RegExp(`/${node.name}$`), '')
              const to = `${parent}/${newName}`
              await invoke('file:rename', { from: node.path, to })
              refresh()
            }
          },
          {
            id: 'copyPath',
            label: '复制路径',
            action: async () => {
              await navigator.clipboard.writeText(node.path)
            }
          },
          {
            id: 'delete',
            label: '删除文件',
            destructive: true,
            action: async () => {
              if (!window.confirm(`确认删除文件 ${node.name}？`)) return
              await invoke('file:delete', { path: node.path })
              refresh()
            }
          }
        ]

    setMenu({ x: e.clientX, y: e.clientY, actions })
  }

  if (error) {
    return (
      <div className="file-tree" data-testid="file-tree">
        <div className="file-tree-error">加载失败: {error}</div>
      </div>
    )
  }

  return (
    <div className="file-tree" data-testid="file-tree">
      <div className="file-tree-header">Files · {cwd.split('/').pop() || cwd}</div>
      <div className="file-tree-body">
        {root.map((n) => (
          <TreeNode
            key={n.path}
            node={n}
            depth={0}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
            refresh={refresh}
          />
        ))}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          actions={menu.actions.filter((a) => a.id !== 'divider1')}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}