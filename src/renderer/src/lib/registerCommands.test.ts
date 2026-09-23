import { describe, expect, it, beforeEach, vi } from 'vitest'
import { registerAllCommands } from './registerCommands'
import { getCommands } from './commands'
import { useEditorStore } from '../state/editorStore'
import { useChatStore } from '../state/chatStore'
import { useSessionStore } from '../state/sessionStore'
import { useConfigStore } from '../state/configStore'
import { setIpcOverride } from '../ipc/client'
import type { RendererApi } from '@shared/ipc'

/** spec: editor-save-consistency AC-2/3 —— 命令面板保存写最新内容 */

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
  useChatStore.setState({ status: 'idle', items: [], streamingId: null })
  useSessionStore.setState({ sessions: [], activeId: null })
  useConfigStore.setState({
    cwd: '/project',
    loaded: true,
    editor: { wordWrap: false, minimap: false, fontSize: 13, theme: 'vs-dark' }
  })
  useEditorStore.setState({ tabs: [], activePath: null })
})

function seedDirtyTab(content: string): void {
  useEditorStore.getState().open('/a.ts', {
    content: 'on-disk',
    size: 7,
    mtime: 1,
    isBinary: false,
    isTooLarge: false
  })
  useEditorStore.getState().updateContent('/a.ts', content)
}

describe('registerCommands editor.save', () => {
  it('以 store 最新 content 调 file:write，而非打开时的旧内容 (AC-2)', async () => {
    seedDirtyTab('fresh typing')
    const unregister = registerAllCommands()
    const cmd = getCommands().find((c) => c.id === 'editor.save')!
    await cmd.action()

    expect(invokeMock).toHaveBeenCalledWith('file:write', { path: '/a.ts', content: 'fresh typing' })
    expect(useEditorStore.getState().tabs[0].dirty).toBe(false)
    unregister()
  })

  it('file:write 失败时保留 dirty，不调用 markSaved (AC-3)', async () => {
    seedDirtyTab('fresh typing')
    invokeMock.mockRejectedValueOnce(new Error('disk full'))
    const unregister = registerAllCommands()
    const cmd = getCommands().find((c) => c.id === 'editor.save')!
    await cmd.action()

    expect(useEditorStore.getState().tabs[0].dirty).toBe(true)
    unregister()
  })

  it('二进制/超大占位 tab 直接 no-op (AC-2)', async () => {
    useEditorStore.getState().open('/bin.dat', {
      content: '',
      size: 100,
      mtime: 1,
      isBinary: true,
      isTooLarge: false
    })
    const unregister = registerAllCommands()
    const cmd = getCommands().find((c) => c.id === 'editor.save')!
    await cmd.action()

    expect(invokeMock).not.toHaveBeenCalledWith('file:write', expect.anything())
    unregister()
  })
})
