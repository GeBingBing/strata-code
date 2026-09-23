import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../state/chatStore'
import type { MentionAttachment } from '@shared/types'

interface Props {
  /** 文件绝对路径 */
  path: string
  /** 文件名（仅展示） */
  basename: string
  /** 行范围（1-indexed，end 为闭区间） */
  startLine: number
  endLine: number
  onClose: () => void
}

/**
 * spec: inline-chat —— 编辑器内 Cmd+K 浮层。
 * 提交时构造 range 附件，复用 chatStore.send。
 */
export function InlineChat({ path, basename, startLine, endLine, onClose }: Props): React.JSX.Element {
  const [text, setText] = useState('')
  const send = useChatStore((s) => s.send)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const submit = async (): Promise<void> => {
    const value = text.trim()
    if (!value) return
    const range = endLine >= startLine ? { startLine, endLine } : { startLine, endLine: startLine }
    const attachment: MentionAttachment = {
      type: 'range',
      id: `range-${path}-${range.startLine}-${range.endLine}-${Date.now()}`,
      path,
      label: `${basename}:${range.startLine}-${range.endLine}`,
      range
    }
    setText('')
    await send(value, [attachment])
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div
      className="inline-chat"
      data-testid="inline-chat"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="inline-chat-header">
        {basename}:{startLine}-{endLine}
      </div>
      <textarea
        ref={textareaRef}
        data-testid="inline-chat-input"
        value={text}
        placeholder="对选中代码说点什么…（Enter 发送，Esc 取消）"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
      />
      <div className="inline-chat-actions">
        <button type="button" className="btn" onClick={onClose} data-testid="inline-chat-cancel">
          取消
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => void submit()}
          disabled={!text.trim()}
          data-testid="inline-chat-send"
        >
          发送
        </button>
      </div>
    </div>
  )
}
