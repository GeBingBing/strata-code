import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GitPanel } from './GitPanel'
import { useConfigStore } from '../../state/configStore'
import { setIpcOverride } from '../../ipc/client'
import type { RendererApi } from '@shared/ipc'
import type { GitCommit, GitStatus } from '@shared/types'

/** spec: sidebar-registry AC-6 —— GitPanel */

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

describe('GitPanel', () => {
  it('无 cwd 时显示提示', () => {
    useConfigStore.setState({ cwd: '' })
    render(<GitPanel />)
    expect(screen.getByTestId('git-panel')).toHaveTextContent('请先打开工作区')
  })

  it('渲染 branch 与最近 commit', async () => {
    const status: GitStatus = { branch: 'main', files: [{ path: 'a.ts', status: 'M' }] }
    const commits: GitCommit[] = [{ sha: 'abc1234', message: 'init commit', date: Date.now() }]
    invokeMock
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce(commits)

    render(<GitPanel />)

    await vi.waitFor(() => {
      expect(screen.getByTestId('git-branch')).toHaveTextContent('main')
      expect(screen.getByTestId('git-file-a.ts')).toBeInTheDocument()
      expect(screen.getByTestId('git-commit-abc1234')).toBeInTheDocument()
    })
  })

  it('空 status 显示「工作区干净」', async () => {
    invokeMock
      .mockResolvedValueOnce({ branch: 'main', files: [] })
      .mockResolvedValueOnce([])
    render(<GitPanel />)

    await vi.waitFor(() => {
      expect(screen.getByText('工作区干净')).toBeInTheDocument()
    })
  })
})
