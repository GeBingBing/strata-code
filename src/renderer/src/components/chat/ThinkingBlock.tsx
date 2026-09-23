import { useState } from 'react'
import { useConfigStore } from '../../state/configStore'

/**
 * 可折叠的 thinking 块 —— 类似 Cursor / Claude / Codex。
 * 默认折叠，显示摘要行；展开后以等宽字体展示完整 thinking 文本。
 *
 * spec: cursor-parity AC-9 —— 初始展开与否跟随 configStore.thinkingDefaultExpanded；
 * 用户点击后该实例的本地状态独立覆盖默认。
 */
export function ThinkingBlock({ text }: { text: string }): React.JSX.Element {
  const defaultExpanded = useConfigStore((s) => s.thinkingDefaultExpanded)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const summary = text.split('\n')[0]?.slice(0, 80) ?? ''

  return (
    <div className="thinking-block" data-testid="thinking-block">
      <button
        type="button"
        className="thinking-summary"
        data-testid="thinking-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="thinking-caret">{expanded ? '▼' : '▶'}</span>
        <span className="thinking-label">思考过程</span>
        {!expanded && <span className="thinking-preview">{summary}</span>}
      </button>
      {expanded && (
        <pre className="thinking-body" data-testid="thinking-body">
          {text}
        </pre>
      )}
    </div>
  )
}
