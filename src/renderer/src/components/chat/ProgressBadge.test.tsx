import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBadge } from './ProgressBadge'

describe('ProgressBadge', () => {
  it('有 text 时显示估算 tokens', () => {
    render(<ProgressBadge text="hello world" />)
    const badge = screen.getByTestId('progress-badge')
    // "hello world" 11 字符 / 4 ≈ 3 tokens
    expect(badge).toHaveTextContent(/3/)
    expect(badge).toHaveTextContent(/tok/)
  })

  it('空文本时不渲染', () => {
    const { container } = render(<ProgressBadge text="" />)
    expect(container.firstChild).toBeNull()
  })

  it('长文本 token 估算 >= 10', () => {
    render(<ProgressBadge text={Array.from({ length: 100 }, () => 'word').join(' ')} />)
    expect(screen.getByTestId('progress-badge').textContent).toMatch(/\d+ tok/)
  })
})