import type { UiItem } from './applySdkMessage'

/** 将 UiItem[] 导出为 Markdown（session-export AC-2/4） */
export function exportToMarkdown(items: UiItem[]): string {
  const lines: string[] = ['# 会话导出\n']
  for (const item of items) {
    switch (item.kind) {
      case 'user':
        lines.push(`## User\n`)
        if (item.attachments && item.attachments.length > 0) {
          lines.push('**Attachments:**')
          for (const a of item.attachments) {
            const range = a.range ? ` (${a.range.startLine}-${a.range.endLine})` : ''
            lines.push(`- [${a.type}] ${a.label}${range}`)
          }
          lines.push('')
        }
        lines.push(`${item.text}\n`)
        break
      case 'assistant':
        lines.push(`## Assistant\n\n${item.text}\n`)
        break
      case 'tool':
        lines.push(
          `### Tool: ${item.toolName} (${item.status})\n\n\`\`\`json\n${JSON.stringify(item.input, null, 2)}\n\`\`\``
        )
        if (item.output) {
          lines.push(`\n\`\`\`\n${item.output}\n\`\`\`\n`)
        } else {
          lines.push('')
        }
        break
      case 'error':
        lines.push(`## Error\n\n> ${item.text}\n`)
        break
      case 'memory':
        lines.push(`### 从记忆中召回 (${item.source})\n`)
        for (const entry of item.entries) {
          lines.push(`> [${entry.kind}] ${entry.content}`)
        }
        lines.push('')
        break
      case 'compact':
        lines.push(
          item.postTokens !== undefined
            ? `--- 上下文已压缩 (${item.trigger}): ${item.preTokens} → ${item.postTokens} tokens ---\n`
            : `--- 上下文已压缩 (${item.trigger}) ---\n`
        )
        break
    }
  }
  return lines.join('\n')
}

/** 将 UiItem[] 导出为 JSON（session-export AC-3） */
export function exportToJson(items: UiItem[]): string {
  return JSON.stringify(items, null, 2)
}
