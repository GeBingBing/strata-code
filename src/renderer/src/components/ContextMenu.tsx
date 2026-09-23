import { useEffect, useRef, useState } from 'react'

export interface ContextMenuAction {
  id: string
  label: string
  destructive?: boolean
  disabled?: boolean
  /** 如果设置，菜单项会展开为输入模式（用于重命名/新建文件等） */
  prompt?: {
    label: string
    defaultValue?: string
    placeholder?: string
  }
  action?: (value?: string) => void | Promise<void>
}

interface Props {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

/**
 * 自绘右键菜单（HTML/CSS 实现，避免使用浏览器原生菜单 / Electron Menu）。
 * 支持普通菜单项与带输入框的菜单项（重命名 / 新建文件等）。
 */
export function ContextMenu({ x, y, actions, onClose }: Props): React.JSX.Element {
  const [promptingId, setPromptingId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (promptingId) inputRef.current?.focus()
  }, [promptingId])

  const submit = async (action: ContextMenuAction): Promise<void> => {
    const value = action.prompt ? inputValue.trim() : undefined
    if (action.prompt && !value) return
    onClose()
    try {
      await action.action?.(value)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('context menu action failed:', err)
    }
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      data-testid="context-menu"
      style={{ left: x, top: y }}
    >
      {actions.map((a) => (
        <div key={a.id} className="context-menu-item">
          {promptingId === a.id ? (
            <form
              className="context-menu-prompt"
              onSubmit={(e) => {
                e.preventDefault()
                void submit(a)
              }}
            >
              <input
                ref={inputRef}
                type="text"
                defaultValue={a.prompt?.defaultValue}
                placeholder={a.prompt?.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                data-testid={`context-menu-input-${a.id}`}
              />
              <button type="submit" className="context-menu-submit" data-testid={`context-menu-submit-${a.id}`}>
                ↵
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={`context-menu-button ${a.destructive ? 'destructive' : ''}`}
              data-testid={`context-menu-${a.id}`}
              disabled={a.disabled}
              onClick={() => {
                if (a.prompt) {
                  setInputValue(a.prompt.defaultValue ?? '')
                  setPromptingId(a.id)
                  return
                }
                void submit(a)
              }}
            >
              {a.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}