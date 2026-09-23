import { useEffect, useMemo, useRef } from 'react'
import { useChatStore } from '../../state/chatStore'
import { usePermissionStore } from '../../state/permissionStore'
import { AssistantTurn } from './AssistantTurn'
import { PermissionRequestItem } from '../permissions/PermissionRequest'
import { Composer } from './Composer'
import { ProgressBadge } from './ProgressBadge'
import type { UiItem } from '../../lib/applySdkMessage'

type Turn = {
  user?: Extract<UiItem, { kind: 'user' }>
  assistant: UiItem[]
}

function buildTurns(items: UiItem[]): Turn[] {
  const turns: Turn[] = []
  let current: Turn = { assistant: [] }
  for (const item of items) {
    if (item.kind === 'user') {
      if (current.user || current.assistant.length > 0) turns.push(current)
      current = { user: item, assistant: [] }
    } else {
      current.assistant.push(item)
    }
  }
  if (current.user || current.assistant.length > 0) turns.push(current)
  return turns
}

export function ChatView(): React.JSX.Element {
  const items = useChatStore((s) => s.items)
  const streamingId = useChatStore((s) => s.streamingId)
  const status = useChatStore((s) => s.status)
  const requests = usePermissionStore((s) => s.requests)

  // 流式进度徽标（spec: cursor-parity AC-5）
  const streamingItem =
 status === 'running' && streamingId
      ? items.find((i) => i.kind === 'assistant' && i.id === streamingId)
      : undefined
  const streamingText =
    streamingItem && streamingItem.kind === 'assistant' ? streamingItem.text : ''
  const bottomRef = useRef<HTMLDivElement>(null)

  const turns = useMemo(() => buildTurns(items), [items])

  useEffect(() => {
    // 流式过程中使用 auto 滚动，避免 smooth 动画与高频 partial 更新叠加造成抖动
    const behavior = streamingId != null ? ('auto' as const) : ('smooth' as const)
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [items, streamingId, requests.length])

  return (
    <div className="chat-view">
      <div className="message-list">
        {items.length === 0 && requests.length === 0 && (
          <div className="empty-state">
            <h2>开始对话</h2>
            <p>向 Claude 描述任务，它会读取、编辑文件并执行命令。</p>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="qa-pair" data-testid="qa-pair">
            {turn.user && (
              <div className="message user" data-testid="message-user">
                <div className="bubble">{turn.user.text}</div>
              </div>
            )}
            {turn.assistant.length > 0 && (
              <AssistantTurn items={turn.assistant as Parameters<typeof AssistantTurn>[0]['items']} />
            )}
          </div>
        ))}
        {requests.map((req) => (
          <PermissionRequestItem key={req.id} request={req} />
        ))}
        {streamingText && <ProgressBadge text={streamingText} />}
        <div ref={bottomRef} />
      </div>
      <Composer />
    </div>
  )
}
