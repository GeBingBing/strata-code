import { createTwoFilesPatch } from 'diff'

/**
 * 从 Edit/Write 工具入参生成 unified diff 文本（diff-approval spec）。
 * 其他工具返回 null。
 */
export function diffFromToolInput(
  toolName: string,
  input: Record<string, unknown> | undefined
): { filePath: string; patch: string } | null {
  if (!input) return null

  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
    const filePath = String(input.file_path ?? input.filePath ?? 'file')
    if (toolName === 'Write') {
      const content = String(input.content ?? '')
      const patch = createTwoFilesPatch('', filePath, '', content, '', 'new file')
      return { filePath, patch }
    }
    if (toolName === 'Edit') {
      const oldStr = String(input.old_string ?? '')
      const newStr = String(input.new_string ?? '')
      const patch = createTwoFilesPatch(filePath, filePath, oldStr, newStr, 'old', 'new')
      return { filePath, patch }
    }
    if (toolName === 'MultiEdit') {
      const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : []
      let patch = ''
      for (const edit of edits) {
        patch += createTwoFilesPatch(
          filePath,
          filePath,
          String(edit.old_string ?? ''),
          String(edit.new_string ?? ''),
          'old',
          'new'
        )
      }
      return { filePath, patch }
    }
  }

  if (toolName === 'NotebookEdit') {
    const filePath = String(input.notebook_path ?? 'notebook')
    return { filePath, patch: '' }
  }

  return null
}
