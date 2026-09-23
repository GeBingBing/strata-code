import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('shiki', () => ({
  bundledLanguages: { ts: { name: 'TypeScript', aliases: ['typescript'] } },
  getSingletonHighlighter: () =>
    Promise.resolve({
      codeToHtml: (_code: string, opts: { lang: string }) =>
        `<pre><code class="hljs language-${opts.lang}">highlighted</code></pre>`
    })
}))

import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('AC-1: 渲染 h2 + 代码块经 CodeBlock 高亮', async () => {
    const { container } = render(
      <Markdown text={'## Title\n\n```ts\nconst x = 1\n```'} streaming={false} />
    )
    expect(container.querySelector('h2')?.textContent).toBe('Title')
    expect(container.querySelector('[data-testid="code-block"]')).toBeInTheDocument()
    await waitFor(() => {
      expect(container.innerHTML).toMatch(/hljs/)
    })
  })

  it('普通段落渲染', () => {
    const { container } = render(<Markdown text="hello **bold**" streaming={false} />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('流式与非流式模式下都能渲染（光标由调用方负责）', () => {
    const { container: a } = render(<Markdown text="hi" streaming />)
    const { container: b } = render(<Markdown text="hi" streaming={false} />)
    expect(a.textContent).toBe('hi')
    expect(b.textContent).toBe('hi')
  })

  it('remark-gfm: 表格渲染', () => {
    const { container } = render(
      <Markdown text={'| a | b |\n| - | - |\n| 1 | 2 |'} streaming={false} />
    )
    expect(container.querySelector('table')).toBeInTheDocument()
  })
})