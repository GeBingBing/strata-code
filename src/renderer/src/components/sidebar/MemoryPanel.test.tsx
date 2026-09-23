import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryPanel } from './MemoryPanel'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { MemoryEntry } from '@shared/types'

/** spec: sidebar-registry AC-7 —— MemoryPanel */

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
})

const projectEntry: MemoryEntry = {
  id: 'm1',
  kind: 'preference',
  scope: 'project',
  cwd: '/project',
  content: 'use TypeScript',
  confidence: 0.8,
  hits: 1,
  tags: [],
  sourceSessionId: 's1',
  createdAt: 1,
  updatedAt: 1
}

const globalEntry: MemoryEntry = {
  ...projectEntry,
  id: 'm2',
  scope: 'global',
  cwd: null,
  content: 'always run tests'
}

describe('MemoryPanel', () => {
  it('调用 memory:list 并渲染全局/项目记忆', async () => {
    invokeMock.mockResolvedValueOnce([projectEntry, globalEntry])
    render(<MemoryPanel />)

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('memory:list', undefined)
      expect(screen.getByTestId('memory-item-m1')).toHaveTextContent('use TypeScript')
      expect(screen.getByTestId('memory-item-m2')).toHaveTextContent('always run tests')
    })
  })

  it('点击 × 调用 memory:delete', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    invokeMock
      .mockResolvedValueOnce([globalEntry])
      .mockResolvedValueOnce([])
    render(<MemoryPanel />)

    await vi.waitFor(() => expect(screen.getByTestId('memory-item-m2')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('memory-item-m2').querySelector('button')!)

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('memory:delete', { id: 'm2' })
    })
    confirmMock.mockRestore()
  })
})
