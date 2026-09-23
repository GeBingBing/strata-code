import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineChat } from './InlineChat'
import { useChatStore } from '../../state/chatStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: inline-chat —— 浮层发送构建正确 range 附件 */

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
    send: useChatStore.getState().send
  })
})

describe('InlineChat', () => {
  it('显示选区范围头', () => {
    render(<InlineChat path="/x.ts" basename="x.ts" startLine={12} endLine={18} onClose={() => {}} />)
    expect(screen.getByTestId('inline-chat')).toBeInTheDocument()
    expect(screen.getByText('x.ts:12-18')).toBeInTheDocument()
  })

  it('Enter 发送构造 range 附件', async () => {
    const sendSpy = vi.spyOn(useChatStore.getState(), 'send')

    render(<InlineChat path="/x.ts" basename="x.ts" startLine={12} endLine={18} onClose={() => {}} />)
    const input = screen.getByTestId('inline-chat-input')
    fireEvent.change(input, { target: { value: 'explain this' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await vi.waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith('explain this', [
        expect.objectContaining({
          type: 'range',
          path: '/x.ts',
          label: 'x.ts:12-18',
          range: { startLine: 12, endLine: 18 }
        })
      ])
    })
    sendSpy.mockRestore()
  })

  it('空文本禁用发送按钮', () => {
    render(<InlineChat path="/x.ts" basename="x.ts" startLine={1} endLine={2} onClose={() => {}} />)
    expect((screen.getByTestId('inline-chat-send') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Esc 触发 onClose', () => {
    const onClose = vi.fn()
    render(<InlineChat path="/x.ts" basename="x.ts" startLine={1} endLine={2} onClose={onClose} />)
    fireEvent.keyDown(screen.getByTestId('inline-chat-input'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
