import { useState } from 'react'
import type { UiItem } from '../../lib/applySdkMessage'
import { diffFromToolInput } from '../../lib/diffFromToolInput'
import { DiffPreview } from '../diff/DiffPreview'
import { CodeBlock } from '../markdown/CodeBlock'

type ToolItem = Extract<UiItem, { kind: 'tool' }>

export function ToolCallCard({ item }: { item: ToolItem }): React.JSX.Element {
  // 默认折叠：保持聊天流不冗长，用户点开再查看详情
  const [open, setOpen] = useState(false)
  const diff = diffFromToolInput(item.toolName, item.input as Record<string, unknown> | undefined)
  const filePath = (item.input as Record<string, unknown> | undefined)?.file_path as
    | string
    | undefined
  const isRead = item.toolName === 'Read' && Boolean(filePath)

  return (
    <div className={`tool-card ${item.status}`} data-testid={`tool-card-${item.status}`}>
      <button type="button" className="tool-header" onClick={() => setOpen(!open)}>
        <span className="tool-icon">{iconFor(item.status)}</span>
        <span className="tool-name">{item.toolName}</span>
        <span className="tool-summary">{summarize(item)}</span>
        {item.output && <span className="tool-output-preview">{previewOutput(item.output)}</span>}
        <span className="chevron">{open ? '▾' : '▸'}</span>
      </button>

      {/* spec: cursor-parity AC-3 —— Read 工具顶部文件路径面包屑 */}
      {isRead && filePath && (
        <div className="tool-breadcrumb" data-testid="tool-card-breadcrumb" title={filePath}>
          {basename(filePath)}
        </div>
      )}

      {open && (
        <div className="tool-body">
          {/* 顺序：调用参数 → 执行结果（展开后才显示完整） */}
          <details className="tool-section">
            <summary>调用参数</summary>
            <pre>{JSON.stringify(item.input, null, 2)}</pre>
          </details>
          {item.output && (
            <div className="tool-section tool-output">
              <div className="tool-section-label">执行结果</div>
              {/* spec: cursor-parity AC-4 —— Read 默认折叠；展开后行号 + 高亮 */}
              {isRead ? (
                <details className="read-output-details" data-testid="tool-card-read-output-details">
                  <summary>查看文件内容（{item.output.split('\n').length} 行）</summary>
                  <div className="read-output">
                    <ReadLineNumbers text={item.output} />
                    <pre className="read-code">
                      <CodeBlock className="language-ts">{truncate(item.output, 2000)}</CodeBlock>
                    </pre>
                  </div>
                </details>
              ) : (
                <pre>{truncate(item.output, 2000)}</pre>
              )}
            </div>
          )}
        </div>
      )}
      {diff && <DiffPreview filePath={diff.filePath} patch={diff.patch} />}
    </div>
  )
}

/** 预览：取 output 前 2 行，截断到 120 字符 */
function previewOutput(text: string): string {
  const lines = text.split('\n').slice(0, 2)
  const flat = lines.join(' ').replace(/\s+/g, ' ').trim()
  return flat.length > 120 ? flat.slice(0, 120) + '…' : flat
}

function iconFor(status: ToolItem['status']): string {
  return status === 'running' ? '◌' : status === 'success' ? '✓' : '✗'
}

function summarize(item: ToolItem): string {
  const input = item.input as Record<string, unknown> | undefined
  if (input?.file_path) return String(input.file_path)
  if (input?.command) return String(input.command).slice(0, 60)
  if (input?.pattern) return String(input.pattern)
  return ''
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} 字符已截断)` : text
}

function basename(p: string): string {
  return p.split('/').pop() ?? p
}

/** 行号容器（spec: cursor-parity AC-4） */
function ReadLineNumbers({ text }: { text: string }): React.JSX.Element {
  const lineCount = text.split('\n').length
  const nums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')
  return (
    <pre className="read-line-numbers" data-testid="tool-card-read-line-numbers" aria-hidden>
      {nums}
    </pre>
  )
}
