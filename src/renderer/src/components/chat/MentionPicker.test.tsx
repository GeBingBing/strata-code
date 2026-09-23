import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MentionPicker, filterMentions } from './MentionPicker'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { FileNode } from '@shared/types'

/** spec: file-context-mentions AC-1/2 —— MentionPicker */

const invokeMock = vi.fn()

function makeApi(): RendererApi {
  return {
    invoke: invokeMock as never,
    on: (() => () => {}) as never
  }
}

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue([])
  setIpcOverride(makeApi())
})

describe('filterMentions', () => {
  it('按 label 模糊过滤并限制 50 条', () => {
    const items = [
      { type: 'file' as const, path: '/a.ts', label: 'a.ts' },
      { type: 'file' as const, path: '/b.ts', label: 'b.ts' }
    ]
    expect(filterMentions(items, 'a')).toEqual([items[0]])
  })
})

describe('MentionPicker', () => {
  it('渲染文件列表', async () => {
    const tree: FileNode[] = [
      { name: 'a.ts', path: '/project/a.ts', isDirectory: false },
      { name: 'src', path: '/project/src', isDirectory: true, children: [
        { name: 'b.ts', path: '/project/src/b.ts', isDirectory: false }
      ]}
    ]
    invokeMock.mockResolvedValue(tree)

    render(<MentionPicker query="" onSelect={() => {}} onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByTestId('mention-item-/project/a.ts')).toBeInTheDocument()
      expect(screen.getByTestId('mention-item-/project/src/b.ts')).toBeInTheDocument()
    })
  })

  it('点击文件调用 onSelect', async () => {
    const tree: FileNode[] = [
      { name: 'a.ts', path: '/project/a.ts', isDirectory: false }
    ]
    invokeMock.mockResolvedValue(tree)
    const onSelect = vi.fn()

    render(<MentionPicker query="" onSelect={onSelect} onClose={() => {}} />)

    await vi.waitFor(() => expect(screen.getByTestId('mention-item-/project/a.ts')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('mention-item-/project/a.ts'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ type: 'file', path: '/project/a.ts', label: 'a.ts' }))
  })

  it('按 query 过滤', async () => {
    const tree: FileNode[] = [
      { name: 'a.ts', path: '/project/a.ts', isDirectory: false },
      { name: 'b.ts', path: '/project/b.ts', isDirectory: false }
    ]
    invokeMock.mockResolvedValue(tree)

    render(<MentionPicker query="b" onSelect={() => {}} onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.queryByTestId('mention-item-/project/a.ts')).not.toBeInTheDocument()
      expect(screen.getByTestId('mention-item-/project/b.ts')).toBeInTheDocument()
    })
  })
})
