import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Composer } from './Composer'
import { useChatStore } from '../../state/chatStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { FileNode } from '@shared/types'

/** spec: chat-ui AC-6/7 + file-context-mentions —— Composer 提交、停止与 @ 提及 */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  setIpcOverride(makeApi())
  useChatStore.setState({
    status: 'idle',
    items: [],
    streamingId: null,
    composerDraft: '',
    history: [],
    historyCursor: null,
    preHistoryDraft: '',
    send: useChatStore.getState().send,
    stop: useChatStore.getState().stop,
    retry: useChatStore.getState().retry,
    setComposerDraft: useChatStore.getState().setComposerDraft,
    navigateHistory: useChatStore.getState().navigateHistory,
    connect: useChatStore.getState().connect
  })
})

describe('Composer', () => {
  it('AC-7: 输入文本 + Enter → agent:send + 乐观用户气泡', async () => {
    render(<Composer />)
    const input = screen.getByTestId('composer-input')
    fireEvent.change(input, { target: { value: '帮我写个函数' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('agent:send', expect.objectContaining({ text: '帮我写个函数' }))
    })
    // 乐观 UI
    expect(useChatStore.getState().items[0]).toMatchObject({
      kind: 'user',
      text: '帮我写个函数'
    })
    // 输入框清空
    expect((input as HTMLTextAreaElement).value).toBe('')
  })

  it('Shift+Enter 不发送（换行）', () => {
    render(<Composer />)
    const input = screen.getByTestId('composer-input')
    fireEvent.change(input, { target: { value: 'text' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('AC-6: agent 运行中显示停止按钮，点击 → agent:interrupt', async () => {
    useChatStore.setState({ status: 'running' })
    render(<Composer />)

    const stopBtn = screen.getByTestId('stop-button')
    fireEvent.click(stopBtn)
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('agent:interrupt')
    })
  })

  it('error 状态显示重试按钮，点击 → 用最后一条用户消息重发', async () => {
    useChatStore.setState({
      status: 'error',
      items: [{ kind: 'user', id: 'u1', text: 'hello' }]
    })
    render(<Composer />)

    const retryBtn = screen.getByTestId('retry-button')
    fireEvent.click(retryBtn)

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('agent:send', expect.objectContaining({ text: 'hello' }))
    })
  })

  it('空文本禁用发送', () => {
    render(<Composer />)
    expect((screen.getByTestId('send-button') as HTMLButtonElement).disabled).toBe(true)
  })

  /** spec: composer-history AC-2 —— ArrowUp 在 start 进入历史 */
  it('ArrowUp 在文本 start 位置进入历史模式显示最新历史', () => {
    useChatStore.setState({
      history: ['older', 'newer'],
      historyCursor: null,
      preHistoryDraft: '',
      composerDraft: 'draft'
    })
    render(<Composer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    // 模拟光标在 start
    fireEvent.change(input, { target: { value: 'draft', selectionStart: 0, selectionEnd: 0 } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })

    expect(useChatStore.getState().historyCursor).toBe(1)
    expect(useChatStore.getState().composerDraft).toBe('newer')
    expect(useChatStore.getState().preHistoryDraft).toBe('draft')
  })

  /** spec: file-context-mentions */
  it('输入 @ 弹出 MentionPicker', async () => {
    const tree: FileNode[] = [{ name: 'a.ts', path: '/project/a.ts', isDirectory: false }]
    invokeMock.mockResolvedValue(tree)
    render(<Composer />)
    const input = screen.getByTestId('composer-input')
    fireEvent.change(input, { target: { value: '@', selectionStart: 1 } })
    await vi.waitFor(() => {
      expect(screen.getByTestId('mention-picker')).toBeInTheDocument()
    })
  })

  it('选择提及后渲染 attachment chip，并附带在 agent:send 中', async () => {
    const tree: FileNode[] = [{ name: 'a.ts', path: '/project/a.ts', isDirectory: false }]
    invokeMock.mockResolvedValue(tree)
    render(<Composer />)
    const input = screen.getByTestId('composer-input')

    fireEvent.change(input, { target: { value: '@a', selectionStart: 2 } })
    await vi.waitFor(() => expect(screen.getByTestId('mention-item-/project/a.ts')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('mention-item-/project/a.ts'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('composer-attachment-file:/project/a.ts')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('send-button'))
    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'agent:send',
        expect.objectContaining({
          text: '',
          attachments: [expect.objectContaining({ type: 'file', path: '/project/a.ts', label: 'a.ts' })]
        })
      )
    })
  })

  it('点击 chip 上的 × 移除 attachment', async () => {
    const tree: FileNode[] = [{ name: 'a.ts', path: '/project/a.ts', isDirectory: false }]
    invokeMock.mockResolvedValue(tree)
    render(<Composer />)
    const input = screen.getByTestId('composer-input')

    fireEvent.change(input, { target: { value: '@a', selectionStart: 2 } })
    await vi.waitFor(() => expect(screen.getByTestId('mention-item-/project/a.ts')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('mention-item-/project/a.ts'))

    await vi.waitFor(() => expect(screen.getByTestId('composer-attachment-file:/project/a.ts')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('remove-attachment-file:/project/a.ts'))
    expect(screen.queryByTestId('composer-attachment-file:/project/a.ts')).not.toBeInTheDocument()
  })
})
