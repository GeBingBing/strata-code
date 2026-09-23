import { describe, expect, it } from 'vitest'
import { markdownToPlainText } from './markdownToPlainText'

/** spec: session-export 1.3 —— markdown → 纯文本 */

describe('markdownToPlainText', () => {
  it('去掉粗体 / 斜体的 ** * 和 __ _', () => {
    expect(markdownToPlainText('**bold** and *italic* and __under__ and _em_')).toBe(
      'bold and italic and under and em'
    )
  })

  it('去掉行内代码与代码块围栏', () => {
    expect(markdownToPlainText('use `npm test`')).toBe('use npm test')
    expect(markdownToPlainText('```ts\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('链接保留文本、去掉 URL；图片保留 alt', () => {
    expect(markdownToPlainText('[docs](https://example.com)')).toBe('docs')
    expect(markdownToPlainText('![logo](https://x/a.png)')).toBe('logo')
  })

  it('去掉标题、引用、列表前缀', () => {
    expect(markdownToPlainText('# Title\n\n- item one\n- item two')).toBe(
      'Title\n\nitem one\nitem two'
    )
    expect(markdownToPlainText('1. first\n2. second')).toBe('first\nsecond')
    expect(markdownToPlainText('> quoted')).toBe('quoted')
  })

  it('混合 markdown 文档 → 仅保留可见文本', () => {
    const md = [
      '# Title',
      '',
      'Hello **world** with `code` and [link](https://x).',
      '',
      '- item 1',
      '- item 2',
      '',
      '```ts',
      'const x = 1',
      '```'
    ].join('\n')
    const out = markdownToPlainText(md)
    expect(out).toContain('Title')
    expect(out).toContain('Hello world with code and link.')
    expect(out).toContain('item 1')
    expect(out).toContain('const x = 1')
    expect(out).not.toContain('**')
    expect(out).not.toContain('`')
    expect(out).not.toContain('#')
    expect(out).not.toContain('](https://x)')
  })
})