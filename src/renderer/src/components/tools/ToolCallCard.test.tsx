import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// stub shiki（同 CodeBlock.test.tsx）
vi.mock('shiki', () => ({
  bundledLanguages: { ts: { name: 'TypeScript', aliases: ['typescript'] } },
  getSingletonHighlighter: () =>
    Promise.resolve({
      codeToHtml: (_c: string, o: { lang: string }) =>
        `<pre><code class="hljs language-${o.lang}">highlighted</code></pre>`
    })
}))

import { ToolCallCard } from './ToolCallCard'
import type { UiItem } from '../../lib/applySdkMessage'

const baseTool = (overrides: Partial<Extract<UiItem, { kind: 'tool' }>> = {}): Extract<UiItem, { kind: 'tool' }> => ({
  kind: 'tool',
  id: 't-1',
  toolName: 'Bash',
  input: { command: 'ls' },
  status: 'success',
  ...overrides
})

describe('ToolCallCard Read 增强（spec: cursor-parity AC-3/4）', () => {
  it('Read 工具：顶部面包屑含文件名 + 完整路径 title', () => {
    render(
      <ToolCallCard
        item={baseTool({
          toolName: 'Read',
          input: { file_path: '/Users/me/project/src/index.ts' }
        })}
      />
    )
    const crumb = screen.getByTestId('tool-card-breadcrumb')
    expect(crumb).toHaveTextContent('index.ts')
    expect(crumb).toHaveAttribute('title', '/Users/me/project/src/index.ts')
  })

  it('Read 工具输出默认折叠；展开后含行号 + CodeBlock 高亮', () => {
    render(
      <ToolCallCard
        item={baseTool({
          toolName: 'Read',
          input: { file_path: '/x/y.ts' },
          output: 'line 1\nline 2\nline 3'
        })}
      />
    )
    // 先展开 ToolCallCard 主体
    fireEvent.click(screen.getByRole('button', { name: /Bash|Read/ }))

    const details = screen.getByTestId('tool-card-read-output-details')
    expect(details).toBeInTheDocument()
    // 再展开 read details
    fireEvent.click(details.querySelector('summary')!)
    expect(screen.getByTestId('tool-card-read-line-numbers')).toBeInTheDocument()
    expect(screen.getByTestId('tool-card-read-line-numbers').textContent).toMatch(/1/)
    expect(screen.getByTestId('code-block')).toBeInTheDocument()
  })

  it('非 Read 工具：保持原有行为（不渲染面包屑/行号）', () => {
    render(<ToolCallCard item={baseTool({ toolName: 'Bash', input: { command: 'ls' } })} />)
    expect(screen.queryByTestId('tool-card-breadcrumb')).toBeNull()
    expect(screen.queryByTestId('tool-card-read-output-details')).toBeNull()
  })
})