import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatView } from './ChatView'
import { useChatStore } from '../../state/chatStore'
import { setIpcOverride } from '../../ipc/client'

/** spec: chat-ui —— ChatView 渲染冒烟（数据来自 chatStore 灌入） */

beforeEach(() => {
  setIpcOverride({
    invoke: vi.fn().mockResolvedValue(undefined) as never,
    on: (() => () => {}) as never
  })
})

describe('ChatView', () => {
  it('空状态显示引导文案', () => {
    useChatStore.setState({ items: [], status: 'idle', streamingId: null })
    render(<ChatView />)
    expect(screen.getByText('开始对话')).toBeInTheDocument()
    expect(screen.getByTestId('composer-input')).toBeInTheDocument()
  })

  it('渲染用户/助手/工具/错误条目', () => {
    useChatStore.setState({
      status: 'idle',
      streamingId: null,
      items: [
        { kind: 'user', id: 'u1', text: '帮我改代码' },
        { kind: 'assistant', id: 'a1', text: '**好的**' },
        {
          kind: 'tool',
          id: 't1',
          toolName: 'Read',
          input: { file_path: '/x.ts' },
          status: 'success',
          output: 'content'
        },
        { kind: 'error', id: 'e1', text: '炸了' }
      ]
    })
    render(<ChatView />)

    expect(screen.getByTestId('message-user')).toHaveTextContent('帮我改代码')
    expect(screen.getByTestId('message-assistant')).toHaveTextContent('好的')
    expect(screen.getByTestId('tool-card-success')).toBeInTheDocument()
    expect(screen.getByTestId('message-error')).toHaveTextContent('炸了')
  })

  it('流式气泡显示打字机光标', () => {
    useChatStore.setState({
      status: 'running',
      streamingId: 'partial-p1',
      items: [{ kind: 'assistant', id: 'partial-p1', text: '正在输入', streaming: true }]
    })
    render(<ChatView />)
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument()
  })
})
