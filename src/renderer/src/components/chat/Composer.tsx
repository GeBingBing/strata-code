import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../state/chatStore'
import { useWorkspaceStore } from '../../state/workspaceStore'
import { MentionPicker } from './MentionPicker'
import type { MentionAttachment } from '@shared/types'
import { FileIcon, FolderIcon } from '../icons'

const DRAFT_DEBOUNCE_MS = 500

export function Composer(): React.JSX.Element {
  const [attachments, setAttachments] = useState<MentionAttachment[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const text = useChatStore((s) => s.composerDraft ?? '')
  const historyCursor = useChatStore((s) => s.historyCursor)
  const status = useChatStore((s) => s.status)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const retry = useChatStore((s) => s.retry)
  const setComposerDraft = useChatStore((s) => s.setComposerDraft)
  const navigateHistory = useChatStore((s) => s.navigateHistory)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeId)
  const updateWorkspaceState = useWorkspaceStore((s) => s.updateState)

  const running = status === 'running'
  const isError = status === 'error'

  // spec: cursor-parity AC-7 —— 「继续」按钮聚焦 composer
  useEffect(() => {
    const onFocus = (): void => {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    window.addEventListener('app:focus-composer', onFocus)
    return () => window.removeEventListener('app:focus-composer', onFocus)
  }, [])

  // spec: composer-history AC-5 —— 草稿防抖写回 workspaceStore
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      if (activeWorkspaceId) {
        void updateWorkspaceState({ chatInputDraft: text || undefined })
      }
    }, DRAFT_DEBOUNCE_MS)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [text, activeWorkspaceId, updateWorkspaceState])

  const submit = async (): Promise<void> => {
    const value = text.trim()
    if ((!value && attachments.length === 0) || running) return
    setAttachments([])
    await send(value, attachments)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    // spec: composer-history AC-4 —— 任何输入自动退出历史模式
    setComposerDraft(value)

    const cursor = e.target.selectionStart
    const before = value.slice(0, cursor)
    const lastAt = before.lastIndexOf('@')
    if (lastAt >= 0) {
      const query = before.slice(lastAt + 1)
      if (!/\s/.test(query)) {
        setMentionOpen(true)
        setMentionQuery(query)
        return
      }
    }
    setMentionOpen(false)
    setMentionQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mentionOpen) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
      return
    }
    // spec: composer-history AC-2 —— 光标在 start 且非空时进入历史
    if (e.key === 'ArrowUp') {
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      if (start === 0 && end === 0 && text !== '') {
        e.preventDefault()
        navigateHistory('up')
        return
      }
    }
    if (e.key === 'ArrowDown') {
      if (historyCursor !== null) {
        e.preventDefault()
        navigateHistory('down')
      }
    }
  }

  const handleSelectMention = (a: MentionAttachment): void => {
    if (attachments.some((x) => x.id === a.id)) {
      setMentionOpen(false)
      setMentionQuery('')
      return
    }

    const textarea = textareaRef.current
    if (textarea) {
      const cursor = textarea.selectionStart
      const before = text.slice(0, cursor)
      const lastAt = before.lastIndexOf('@')
      const after = text.slice(cursor)
      const prefix = lastAt >= 0 ? before.slice(0, lastAt) : before
      const nextText = prefix + after
      setComposerDraft(nextText)
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = prefix.length
        textarea.focus()
      })
    }

    setAttachments([...attachments, a])
    setMentionOpen(false)
    setMentionQuery('')
  }

  const removeAttachment = (id: string): void => {
    setAttachments(attachments.filter((a) => a.id !== id))
  }

  return (
    <div className="composer" style={{ position: 'relative' }}>
      {mentionOpen && (
        <MentionPicker
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setMentionOpen(false)}
        />
      )}
      {attachments.length > 0 && (
        <div className="composer-attachments" data-testid="composer-attachments">
          {attachments.map((a) => (
            <span key={a.id} className="attachment-chip" data-testid={`composer-attachment-${a.id}`}>
              {a.type === 'folder' ? <FolderIcon size={14} /> : <FileIcon size={14} />} {a.label}
              <button
                type="button"
                className="attachment-chip-remove"
                data-testid={`remove-attachment-${a.id}`}
                onClick={() => removeAttachment(a.id)}
                aria-label={`移除 ${a.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        data-testid="composer-input"
        value={text}
        placeholder={running ? 'agent 运行中…' : '描述任务，Enter 发送，Shift+Enter 换行，@ 提及文件'}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      {running ? (
        <button
          type="button"
          data-testid="stop-button"
          className="btn stop"
          onClick={() => void stop()}
        >
          停止
        </button>
      ) : isError ? (
        <button
          type="button"
          data-testid="retry-button"
          className="btn retry"
          onClick={() => void retry()}
        >
          重试
        </button>
      ) : (
        <button
          type="button"
          data-testid="send-button"
          className="btn send"
          disabled={!text.trim() && attachments.length === 0}
          onClick={() => void submit()}
        >
          发送
        </button>
      )}
    </div>
  )
}
