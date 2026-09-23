/**
 * 流式进度徽标（spec: cursor-parity AC-5）。
 * 估算已累积文本的 token 数（粗估：字符数 / 4，与 SDK 估算同阶）。
 * 调用方负责在 idle 时不传 text。
 */
export function ProgressBadge({ text }: { text: string }): React.JSX.Element | null {
  if (!text) return null
  const tokens = Math.max(1, Math.round(text.length / 4))
  return (
    <span className="progress-badge" data-testid="progress-badge">
      已输出 {tokens} tok
    </span>
  )
}