import { describe, expect, it } from 'vitest'
import { exportToJson, exportToMarkdown } from './sessionExport'
import type { UiItem } from './applySdkMessage'

describe('sessionExport', () => {
  const items: UiItem[] = [
    { kind: 'user', id: 'u1', text: 'hello' },
    { kind: 'assistant', id: 'a1', text: '# hi\n\ncode' },
    { kind: 'tool', id: 't1', toolName: 'Read', input: { file_path: '/x' }, status: 'success', output: 'content' },
    { kind: 'error', id: 'e1', text: 'boom' }
  ]

  it('exportToMarkdown 生成 Markdown 文档', () => {
    const md = exportToMarkdown(items)
    expect(md).toContain('# 会话导出')
    expect(md).toContain('## User')
    expect(md).toContain('hello')
    expect(md).toContain('## Assistant')
    expect(md).toContain('# hi')
    expect(md).toContain('### Tool: Read (success)')
    expect(md).toContain('"file_path": "/x"')
    expect(md).toContain('content')
    expect(md).toContain('## Error')
    expect(md).toContain('> boom')
  })

  it('exportToJson 生成 JSON 数组', () => {
    const json = exportToJson(items)
    const parsed = JSON.parse(json) as UiItem[]
    expect(parsed).toHaveLength(4)
    expect(parsed[0]).toMatchObject({ kind: 'user', text: 'hello' })
  })

  /** spec: memory-rendering AC-6 —— 新 kind 的导出格式 */
  it('memory → Markdown 引用块；compact → 压缩标记', () => {
    const md = exportToMarkdown([
      {
        kind: 'memory',
        id: 'm-1',
        source: 'app',
        entries: [
          { kind: 'preference', content: 'User prefers TypeScript.' },
          { kind: 'skill', content: 'Run npm test before commit.' }
        ]
      },
      { kind: 'compact', id: 'c-1', trigger: 'auto', preTokens: 100000, postTokens: 12000 }
    ])
    expect(md).toContain('从记忆中召回')
    expect(md).toContain('> [preference] User prefers TypeScript.')
    expect(md).toContain('> [skill] Run npm test before commit.')
    expect(md).toContain('--- 上下文已压缩 (auto): 100000 → 12000 tokens ---')
  })

  /** spec: file-context-mentions */
  it('user attachments → Markdown 保留；JSON 自动保留', () => {
    const userItem: Extract<UiItem, { kind: 'user' }> = {
      kind: 'user',
      id: 'u1',
      text: 'hello',
      attachments: [
        { type: 'file', id: 'f-1', path: '/x.ts', label: 'x.ts' },
        { type: 'folder', id: 'd-1', path: '/src', label: 'src' },
        { type: 'range', id: 'r-1', path: '/y.ts', label: 'y.ts:10-20', range: { startLine: 10, endLine: 20 } }
      ]
    }
    const items: UiItem[] = [userItem]
    const md = exportToMarkdown(items)
    expect(md).toContain('**Attachments:**')
    expect(md).toContain('- [file] x.ts')
    expect(md).toContain('- [folder] src')
    expect(md).toContain('- [range] y.ts:10-20 (10-20)')

    const json = exportToJson(items)
    const parsed = JSON.parse(json) as UiItem[]
    const first = parsed[0]
    expect(first.kind).toBe('user')
    if (first.kind === 'user') {
      expect(first.attachments).toEqual(userItem.attachments)
    }
  })
})
