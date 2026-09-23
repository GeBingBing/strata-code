import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageItem } from './MessageItem'
import { useChatStore } from '../../state/chatStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { UiItem } from '../../lib/applySdkMessage'

/** spec: error-recovery —— MessageItem 重新生成 */

const invokeMock = vi.fn()
const writeTextMock = vi.fn().mockResolvedValue(undefined)

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  writeTextMock.mockReset().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } })
  setIpcOverride(makeApi())
  useChatStore.setState({
    status: 'idle',
    items: [],
    streamingId: null,
    retry: useChatStore.getState().retry,
    regenerate: useChatStore.getState().regenerate
  })
})

describe('MessageItem', () => {
  it('assistant 消息 hover 显示重新生成按钮', () => {
    const item: UiItem = { kind: 'assistant', id: 'a1', text: 'hi' }
    render(<MessageItem item={item} />)
    expect(screen.getByTestId('regenerate-a1')).toBeInTheDocument()
  })

  it('点击重新生成调用 regenerate(messageId) 并发送前置用户消息', async () => {
    useChatStore.setState({
      items: [
        { kind: 'user', id: 'u1', text: 'prompt' },
        { kind: 'assistant', id: 'a1', text: 'answer' }
      ]
    })
    const item: UiItem = { kind: 'assistant', id: 'a1', text: 'answer' }
    render(<MessageItem item={item} />)

    fireEvent.click(screen.getByTestId('regenerate-a1'))

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('agent:send', { text: 'prompt' })
    })
  })

  it('运行中禁用重新生成按钮', () => {
    useChatStore.setState({ status: 'running' })
    const item: UiItem = { kind: 'assistant', id: 'a1', text: 'hi' }
    render(<MessageItem item={item} />)
    expect((screen.getByTestId('regenerate-a1') as HTMLButtonElement).disabled).toBe(true)
  })

  it('点击复制按钮将消息文本写入剪贴板', async () => {
    const item: UiItem = { kind: 'assistant', id: 'a1', text: 'copy me' }
    render(<MessageItem item={item} />)

    fireEvent.click(screen.getByTestId('copy-raw-a1'))

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('copy me')
    })
  })

  it('assistant 消息包含 thinking 时渲染 ThinkingBlock', () => {
    const item: UiItem = { kind: 'assistant', id: 'a1', text: 'answer', thinking: 'inner thought' }
    render(<MessageItem item={item} />)
    expect(screen.getByTestId('thinking-block')).toHaveTextContent('思考过程')
  })

  /** spec: chat-ui AC-9/10 —— Cursor 式流式 markdown 实时渲染 */
  it('流式 assistant 消息：markdown 实时渲染 + 打字机光标', () => {
    const item: UiItem = {
      kind: 'assistant',
      id: 'a-stream',
      text: 'Answer **bold** and `code`.',
      streaming: true
    }
    render(<MessageItem item={item} />)
    // markdown 实时解析（Cursor 式）
    expect(screen.getByText('bold')).toBeInTheDocument()
    expect(screen.getByText('code')).toBeInTheDocument()
    // 打字机光标保留
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument()
  })

  it('流式 assistant 消息带 thinking 时实时渲染 ThinkingBlock', () => {
    const item: UiItem = {
      kind: 'assistant',
      id: 'a-stream-think',
      text: 'answer',
      thinking: 'inner thought accumulating...',
      streaming: true
    }
    render(<MessageItem item={item} />)
    expect(screen.getByTestId('thinking-block')).toHaveTextContent('inner thought')
  })

  /** spec: cursor-parity AC-7 —— 中断后继续按钮 */
  it('interrupted=true + idle 时显示「继续」按钮，点击后派发 app:focus-composer 并清除 interrupted', () => {
    useChatStore.setState({
      items: [{ kind: 'assistant', id: 'a-int', text: 'partial' }],
      status: 'idle',
      interrupted: true
    })
    render(<MessageItem item={{ kind: 'assistant', id: 'a-int', text: 'partial' }} />)
    const btn = screen.getByTestId('continue-from-a-int')
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    expect(useChatStore.getState().interrupted).toBe(false)
  })

  it('running 时不显示「继续」按钮', () => {
    useChatStore.setState({
      items: [{ kind: 'assistant', id: 'a-run', text: 'partial' }],
      status: 'running',
      interrupted: true
    })
    render(<MessageItem item={{ kind: 'assistant', id: 'a-run', text: 'partial' }} />)
    expect(screen.queryByTestId('continue-from-a-run')).toBeNull()
  })

  /** spec: memory hidden —— 召回块不展示给用户 */
  it('memory 条目 → 不渲染任何内容（默默注入）', () => {
    const { container } = render(
      <MessageItem
        item={{
          kind: 'memory',
          id: 'm-1',
          source: 'app',
          entries: [{ kind: 'preference', content: 'User prefers TypeScript.' }]
        }}
      />
    )
    expect(screen.queryByTestId('memory-recall')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('compact 条目 → 渲染压缩分隔线', () => {
    render(
      <MessageItem
        item={{
          kind: 'compact',
          id: 'c-1',
          trigger: 'auto',
          preTokens: 100000,
          postTokens: 12000
        }}
      />
    )
    const divider = screen.getByTestId('compact-boundary')
    expect(divider).toHaveTextContent('上下文已压缩')
    expect(divider).toHaveTextContent('100000')
    expect(divider).toHaveTextContent('12000')
  })

  /** spec: file-context-mentions */
  it('user 消息渲染 attachment chips', () => {
    const item: UiItem = {
      kind: 'user',
      id: 'u1',
      text: 'review this',
      attachments: [
        { type: 'file', id: 'f-1', path: '/src/a.ts', label: 'a.ts' },
        { type: 'folder', id: 'd-1', path: '/src', label: 'src' }
      ]
    }
    render(<MessageItem item={item} />)
    expect(screen.getByTestId('message-attachments')).toBeInTheDocument()
    expect(screen.getByTestId('attachment-chip-f-1')).toHaveTextContent('a.ts')
    expect(screen.getByTestId('attachment-chip-d-1')).toHaveTextContent('src')
  })

  /** spec: session-export 1.3 —— assistant 消息复制按钮提供 raw/markdown 切换 */
  it('assistant 消息同时暴露 copy-raw 与 copy-md 按钮', () => {
    const item: UiItem = { kind: 'assistant', id: 'a-fmt', text: '**bold** and `code`' }
    render(<MessageItem item={item} />)
    expect(screen.getByTestId('copy-raw-a-fmt')).toBeInTheDocument()
    expect(screen.getByTestId('copy-md-a-fmt')).toBeInTheDocument()
  })

  it('copy-raw 写入原始 markdown 文本', async () => {
    const item: UiItem = { kind: 'assistant', id: 'a-raw', text: '**bold** and `code`' }
    render(<MessageItem item={item} />)

    fireEvent.click(screen.getByTestId('copy-raw-a-raw'))

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('**bold** and `code`')
    })
  })

  it('copy-md 写入去除 markdown 标记后的纯文本', async () => {
    const item: UiItem = {
      kind: 'assistant',
      id: 'a-md',
      text: '# Title\n\n**bold** and `code` and [link](https://x)'
    }
    render(<MessageItem item={item} />)

    fireEvent.click(screen.getByTestId('copy-md-a-md'))

    await vi.waitFor(() => {
      // 期望：去掉 # ** ` [text](url) 等 markdown 标记；保留可见文本
      const calledWith = writeTextMock.mock.calls[0]?.[0] as string
      expect(calledWith).not.toContain('**')
      expect(calledWith).not.toContain('`')
      expect(calledWith).not.toContain('#')
      expect(calledWith).not.toContain('](https://x)')
      expect(calledWith).toContain('Title')
      expect(calledWith).toContain('bold')
      expect(calledWith).toContain('code')
      expect(calledWith).toContain('link')
    })
  })

  it('user / error 消息只暴露 copy-* 按钮（无需 markdown 切换）', () => {
    const userItem: UiItem = { kind: 'user', id: 'u-fmt', text: 'hi' }
    const { rerender } = render(<MessageItem item={userItem} />)
    expect(screen.getByTestId('copy-u-fmt')).toBeInTheDocument()
    expect(screen.queryByTestId('copy-raw-u-fmt')).toBeNull()
    expect(screen.queryByTestId('copy-md-u-fmt')).toBeNull()

    const errItem: UiItem = { kind: 'error', id: 'e-fmt', text: 'oops' }
    rerender(<MessageItem item={errItem} />)
    expect(screen.getByTestId('copy-e-fmt')).toBeInTheDocument()
    expect(screen.queryByTestId('copy-raw-e-fmt')).toBeNull()
    expect(screen.queryByTestId('copy-md-e-fmt')).toBeNull()
  })
})
