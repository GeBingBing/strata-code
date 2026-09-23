import { describe, expect, it, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'

/** spec: editor-save-consistency AC-1 —— 输入即同步 store 并置 dirty */

function seedTab(path: string, content: string): void {
  useEditorStore.getState().open(path, {
    content,
    size: content.length,
    mtime: 1,
    isBinary: false,
    isTooLarge: false
  })
}

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null, pendingCursor: null })
})

describe('editorStore', () => {
  it('updateContent 同步 content 并将 tab 置为 dirty (AC-1)', () => {
    seedTab('/a.ts', 'old')
    useEditorStore.getState().updateContent('/a.ts', 'new typing')

    const tab = useEditorStore.getState().tabs[0]
    expect(tab.content).toBe('new typing')
    expect(tab.dirty).toBe(true)
  })

  it('markSaved 清除 dirty', () => {
    seedTab('/a.ts', 'old')
    useEditorStore.getState().updateContent('/a.ts', 'new')
    useEditorStore.getState().markSaved('/a.ts')

    expect(useEditorStore.getState().tabs[0].dirty).toBe(false)
  })

  /** spec: search-navigation —— cursor 写入 pendingCursor */
  it('open 携带 cursor 时写入 pendingCursor (AC-1)', () => {
    useEditorStore.getState().open('/a.ts', {
      content: '',
      size: 0,
      mtime: 0,
      isBinary: false,
      isTooLarge: false,
      cursor: { line: 12 }
    })
    const hint = useEditorStore.getState().pendingCursor
    expect(hint).toEqual({ path: '/a.ts', line: 12, column: undefined })
  })

  it('open 已存在 tab 时仍写 pendingCursor (AC-2)', () => {
    useEditorStore.getState().open('/a.ts', {
      content: '', size: 0, mtime: 0, isBinary: false, isTooLarge: false
    })
    useEditorStore.getState().open('/a.ts', {
      content: '', size: 0, mtime: 0, isBinary: false, isTooLarge: false,
      cursor: { line: 5 }
    })
    expect(useEditorStore.getState().pendingCursor?.line).toBe(5)
  })

  it('clearPendingCursor 清除意图', () => {
    useEditorStore.getState().open('/a.ts', {
      content: '', size: 0, mtime: 0, isBinary: false, isTooLarge: false,
      cursor: { line: 1 }
    })
    useEditorStore.getState().clearPendingCursor()
    expect(useEditorStore.getState().pendingCursor).toBeNull()
  })

  /** spec: file-watcher —— 静默重载不修改 dirty；冲突标记与接受远端 */
  it('reloadFromDisk 静默更新 content/mtime/size，不改 dirty', () => {
    seedTab('/a.ts', 'old')
    useEditorStore.getState().updateContent('/a.ts', 'typing')
    expect(useEditorStore.getState().tabs[0].dirty).toBe(true)

    useEditorStore.getState().reloadFromDisk('/a.ts', 'remote', 999, 6)

    const tab = useEditorStore.getState().tabs[0]
    expect(tab.content).toBe('remote')
    expect(tab.mtime).toBe(999)
    expect(tab.size).toBe(6)
    expect(tab.dirty).toBe(true) // 不被清
    expect(tab.conflict).toBe(false)
  })

  it('markConflict 置 conflict=true；acceptRemote 清 dirty 与 conflict', () => {
    seedTab('/a.ts', 'old')
    useEditorStore.getState().updateContent('/a.ts', 'typing')
    useEditorStore.getState().markConflict('/a.ts')
    expect(useEditorStore.getState().tabs[0].conflict).toBe(true)

    useEditorStore.getState().acceptRemote('/a.ts')
    const tab = useEditorStore.getState().tabs[0]
    expect(tab.dirty).toBe(false)
    expect(tab.conflict).toBe(false)
  })
})
