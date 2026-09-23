import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchPanel } from './SearchPanel'
import { useConfigStore } from '../../state/configStore'
import { useEditorStore } from '../../state/editorStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { SearchResult, FileContent } from '@shared/types'

/** spec: sidebar-registry AC-5 —— SearchPanel */

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
  useConfigStore.setState({
    cwd: '/project',
    loaded: true,
    pickWorkspace: async () => {},
    switchWorkspace: async () => {},
    removeRecent: () => {},
    load: async () => {},
    setPermissionMode: async () => {},
    setModel: async () => {},
    setTheme: () => {},
    toggleWordWrap: () => {},
    toggleMinimap: () => {},
    setFontSize: () => {}
  })
  useEditorStore.setState({ tabs: [], activePath: null, pendingCursor: null })
})

describe('SearchPanel', () => {
  it('无 cwd 时显示提示', () => {
    useConfigStore.setState({ cwd: '' })
    render(<SearchPanel />)
    expect(screen.getByText('请先打开工作区')).toBeInTheDocument()
  })

  it('输入并按 Enter 调用 search:files 并渲染结果', async () => {
    const results: SearchResult[] = [{ path: 'src/a.ts', line: 12, preview: 'hello world' }]
    invokeMock.mockResolvedValueOnce(results)

    render(<SearchPanel />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('search:files', { path: '/project', query: 'hello' })
      expect(screen.getByTestId('search-result-src/a.ts:12')).toBeInTheDocument()
    })
  })

  /** spec: search-navigation AC-1 —— 点击结果触发 file:read 并 open 带 cursor */
  it('点击结果调用 file:read 并把光标 line 写入 pendingCursor', async () => {
    const results: SearchResult[] = [{ path: 'src/a.ts', line: 12, preview: 'hello world' }]
    const fileContent: FileContent = {
      content: 'hello',
      size: 5,
      mtime: 1,
      isBinary: false,
      isTooLarge: false
    }
    invokeMock
      .mockResolvedValueOnce(results)
      .mockResolvedValueOnce(fileContent)

    render(<SearchPanel />)
    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const result = await screen.findByTestId('search-result-src/a.ts:12')
    fireEvent.click(result)

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('file:read', { path: 'src/a.ts' })
      const hint = useEditorStore.getState().pendingCursor
      expect(hint).toEqual({ path: 'src/a.ts', line: 12, column: undefined })
      const tab = useEditorStore.getState().tabs.find((t) => t.path === 'src/a.ts')
      expect(tab).toBeDefined()
    })
  })

  /** spec: search-navigation AC-2 —— 重复点击同一文件仍更新 cursor */
  it('重复点击同一文件更新 pendingCursor', async () => {
    const results: SearchResult[] = [
      { path: 'a.ts', line: 1, preview: 'x' },
      { path: 'a.ts', line: 20, preview: 'x' }
    ]
    invokeMock.mockResolvedValue(results)

    render(<SearchPanel />)
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'x' } })
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Enter' })
    await vi.waitFor(() => screen.findAllByTestId(/^search-result-/))

    fireEvent.click(screen.getByTestId('search-result-a.ts:1'))
    await vi.waitFor(() => expect(useEditorStore.getState().pendingCursor?.line).toBe(1))
    fireEvent.click(screen.getByTestId('search-result-a.ts:20'))
    await vi.waitFor(() => expect(useEditorStore.getState().pendingCursor?.line).toBe(20))
  })
})
