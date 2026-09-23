import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Stub shiki 同步渲染避免单测成本
vi.mock('shiki', () => ({
  bundledLanguages: {
    ts: { name: 'TypeScript', aliases: ['typescript', 'tsx'] },
    bash: { name: 'Bash', aliases: ['sh', 'shell'] }
  },
  getSingletonHighlighter: () =>
    Promise.resolve({
      codeToHtml: (_code: string, opts: { lang: string }) =>
        `<pre><code class="hljs language-${opts.lang}"><span class="tok-keyword">const</span> x=1</code></pre>`
    })
}))

import { CodeBlock } from './CodeBlock'

describe('CodeBlock', () => {
  it('AC-1: shiki 渲染 ts 代码块产出 token spans', async () => {
    render(
      <pre>
        <CodeBlock className="language-ts">{'const x = 1'}</CodeBlock>
      </pre>
    )
    expect(screen.getByTestId('code-block')).toHaveAttribute('data-language', 'ts')
    // 高亮由 shiki 异步高亮（getSingletonHighlighter 返回 Promise）
    await waitFor(() => {
      expect(document.body.innerHTML).toMatch(/hljs/)
    })
    expect(document.body.innerHTML).toMatch(/tok-keyword/)
  })

  it('AC-6: 不识别的语言走纯文本 fallback（data-language=foobar）', () => {
    render(
      <pre>
        <CodeBlock className="language-foobar">{'plain text'}</CodeBlock>
      </pre>
    )
    expect(screen.getByText('plain text')).toBeInTheDocument()
    expect(screen.getByTestId('code-block')).toHaveAttribute('data-language', 'foobar')
  })

  it('不抛出：children 为空时不崩', () => {
    render(
      <pre>
        <CodeBlock className="language-ts">{''}</CodeBlock>
      </pre>
    )
    expect(document.body).toBeInTheDocument()
  })
})