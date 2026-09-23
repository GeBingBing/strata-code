/**
 * 轻量 unified diff 视图 —— 基于 diff 文本逐行着色（- 红 / + 绿）。
 * Edit/Write/MultiEdit 工具入参 → diffFromToolInput 生成 patch。
 */
export function DiffPreview({
  filePath,
  patch
}: {
  filePath: string
  patch: string
}): React.JSX.Element {
  const lines = patch.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-') || l.startsWith('@@'))

  return (
    <div className="diff-preview" data-testid="diff-preview">
      <div className="diff-file">{filePath}</div>
      <pre className="diff-body">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith('+')
                ? 'diff-add'
                : line.startsWith('-')
                  ? 'diff-del'
                  : 'diff-hunk'
            }
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  )
}
