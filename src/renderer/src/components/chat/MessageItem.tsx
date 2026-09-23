import { memo, useEffect, useRef, useState } from 'react'
import type { UiItem } from '../../lib/applySdkMessage'
import { useChatStore } from '../../state/chatStore'
import { useThrottledValue } from '../../lib/useThrottledValue'
import { markdownToPlainText } from '../../lib/markdownToPlainText'
import { ThinkingBlock } from './ThinkingBlock'
import { Markdown } from '../markdown/Markdown'
import { ToolCallCard } from '../tools/ToolCallCard'
import { CheckIcon, CopyIcon, FileIcon, FolderIcon, RefreshIcon } from '../icons'

/**
 * 复制按钮：点击后短暂显示 check + 文案反馈，避免「点了不知道有没有复制」。
 * 失败时（无 clipboard 权限等）落到 fallback：选中文本 + execCommand。
 */
function CopyButton({
  text,
  testId,
  title = '复制'
}: {
  text: string
  testId: string
  title?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback：选中文本 + execCommand（仅旧 webview）
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        // 彻底失败：给出错误反馈，不闪 ✓
        setCopied(false)
        return
      }
    }
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={`message-action copy ${copied ? 'copied' : ''}`}
      data-testid={testId}
      onClick={() => void handleCopy()}
      title={copied ? '已复制' : title}
      aria-label={copied ? '已复制' : title}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied && <span className="message-action-label">已复制</span>}
    </button>
  )
}

/** spec: session-export 1.3 —— assistant 消息复制按钮提供 raw/markdown 切换 */
function CopyButtonGroup({ text, id }: { text: string; id: string }): React.JSX.Element {
  const plain = markdownToPlainText(text)
  return (
    <span className="message-action-group">
      <CopyButton text={text} testId={`copy-raw-${id}`} title="复制原始 markdown" />
      <CopyButton text={plain} testId={`copy-md-${id}`} title="复制纯文本（去除 markdown 标记）" />
    </span>
  )
}

function MessageItemImpl({ item }: { item: UiItem }): React.JSX.Element {
  const regenerate = useChatStore((s) => s.regenerate)
  const running = useChatStore((s) => s.status) === 'running'
  const interrupted = useChatStore((s) => Boolean(s.interrupted))
  const status = useChatStore((s) => s.status)

  switch (item.kind) {
    case 'user':
      return (
        <div className="message user" data-testid="message-user">
          {item.attachments && item.attachments.length > 0 && (
            <div className="message-attachments" data-testid="message-attachments">
              {item.attachments.map((a) => (
                <span key={a.id} className="attachment-chip" data-testid={`attachment-chip-${a.id}`} title={a.path}>
                  {a.type === 'folder' ? <FolderIcon size={14} /> : <FileIcon size={14} />} {a.label}
                </span>
              ))}
            </div>
          )}
          <div className="bubble">{item.text}</div>
          <CopyButton text={item.text} testId={`copy-${item.id}`} />
        </div>
      )
    case 'assistant':
      return (
        <div className="message assistant" data-testid="message-assistant">
          <div className={`bubble ${item.streaming ? 'streaming markdown' : 'markdown'}`}>
            {item.thinking && <ThinkingBlock text={item.thinking} />}
            <StreamingMarkdown text={item.text} streaming={Boolean(item.streaming)} />
          </div>
          {!item.streaming && (
            <>
              <CopyButtonGroup text={item.text} id={item.id} />
              <button
                type="button"
                className="message-action regenerate"
                data-testid={`regenerate-${item.id}`}
                disabled={running}
                onClick={() => void regenerate(item.id)}
                title="重新生成"
                aria-label="重新生成"
              >
                <RefreshIcon size={14} />
              </button>
            </>
          )}
          {/* spec: cursor-parity AC-7 —— 中断后继续（仅当 status=idle 且 interrupted=true） */}
          {!item.streaming && interrupted && status === 'idle' && (
            <button
              type="button"
              className="continue-from-here"
              data-testid={`continue-from-${item.id}`}
              onClick={() => {
                useChatStore.setState({ interrupted: false })
                window.dispatchEvent(new CustomEvent('app:focus-composer'))
              }}
              title="从中断处继续"
            >
              继续 →
            </button>
          )}
        </div>
      )
    case 'tool':
      return <ToolCallCard item={item} />
    case 'memory':
      // 记忆召回不展示给用户（默默注入上下文）
      return <></>
    case 'compact':
      return (
        <div className="compact-boundary" data-testid="compact-boundary">
          上下文已压缩（{item.trigger}）
          {item.postTokens !== undefined
            ? `：${item.preTokens} → ${item.postTokens} tokens`
            : ''}
        </div>
      )
    case 'error':
      return (
        <div className="message error" data-testid="message-error" role="alert">
          <div className="bubble">{item.text}</div>
          <CopyButton text={item.text} testId={`copy-${item.id}`} />
        </div>
      )
  }
}

/**
 * 流式 markdown 渲染（spec: chat-ui AC-9/10）。
 * - 流式期间：节流至 ~32ms（≈30fps），保留打字机光标
 * - 非流式：直接渲染最终 markdown（无光标）
 */
function StreamingMarkdown({ text, streaming }: { text: string; streaming: boolean }): React.JSX.Element {
  const throttled = useThrottledValue(text, streaming ? 32 : 0)
  if (!streaming) {
    return <Markdown text={text} streaming={false} />
  }
  return (
    <>
      <Markdown text={throttled} streaming />
      <span className="streaming-cursor" data-testid="streaming-cursor" aria-hidden />
    </>
  )
}

export const MessageItem = memo(MessageItemImpl)
