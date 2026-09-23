import type { UiItem } from '../../lib/applySdkMessage'
import { MessageItem } from './MessageItem'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from '../tools/ToolCallCard'

type AssistantItem = Extract<UiItem, { kind: 'assistant' | 'tool' | 'memory' | 'compact' }>

/**
 * 一轮 assistant 响应 —— 记忆召回 / 思考 / 工具调用 / 最终回复整合到一个 QA 单元里。
 *
 * 视觉顺序：压缩边界 → 记忆召回 → 思考 → 工具调用 → 最终回复。
 */
export function AssistantTurn({ items }: { items: AssistantItem[] }): React.JSX.Element {
  // 拆出三类
  let thinking: Extract<UiItem, { kind: 'assistant' }> | undefined
  for (const it of items) {
    if (it.kind === 'assistant' && it.thinking && !it.streaming) {
      thinking = it
      break
    }
  }

  const memories: Array<Extract<UiItem, { kind: 'memory' }>> = []
  const compacts = items.filter((it) => it.kind === 'compact') as Extract<
    UiItem,
    { kind: 'compact' }
  >[]

  const tools = items.filter((it) => it.kind === 'tool') as Extract<UiItem, { kind: 'tool' }>[]
  const errors: Extract<UiItem, { kind: 'error' }>[] = []
  for (const it of items as UiItem[]) {
    if (it.kind === 'error') errors.push(it)
  }

  const assistants = items.filter((it) => it.kind === 'assistant') as Extract<
    UiItem,
    { kind: 'assistant' }
  >[]
  // 取最后一条 assistant text 作为最终回复
  const finalAssistant = [...assistants].reverse().find((it) => it.text || it.streaming)

  const running = items.some((it) => it.kind === 'assistant' && it.streaming)

  return (
    <div className="assistant-turn" data-testid="assistant-turn" data-running={running}>
      <div className="turn-avatar" aria-hidden>
        <span>AI</span>
      </div>
      <div className="turn-body">
        {compacts.map((c) => (
          <MessageItem key={c.id} item={c} />
        ))}
        {memories.map((m) => (
          <MessageItem key={m.id} item={m} />
        ))}
        {thinking && thinking.thinking && <ThinkingBlock text={thinking.thinking} />}
        {tools.map((tool) => (
          <ToolCallCard key={tool.id} item={tool} />
        ))}
        {errors.map((err) => (
          <MessageItem key={err.id} item={err} />
        ))}
        {finalAssistant && <MessageItem item={finalAssistant} />}
        {!thinking && tools.length === 0 && errors.length === 0 && !finalAssistant && (
          <div className="turn-placeholder">…</div>
        )}
      </div>
    </div>
  )
}