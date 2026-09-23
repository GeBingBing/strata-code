import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileService } from '../../src/main/files/fileService'
import { WorkspaceStore } from '../../src/main/workspace/WorkspaceStore'

/** spec: workspace-foundation AC-2/3 / workspace-management AC-1/2/3 —— 工作区切换与持久化 */

function createFakeWin() {
  const sent: Array<{ channel: string; payload: unknown }> = []
  return {
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
    sent
  }
}

describe('workspace root following', () => {
  it('切换工作目录后，新目录文件可读取并广播 workspace:changed', async () => {
    const win = createFakeWin()
    const oldRoot = await mkdtemp(join(tmpdir(), 'ws-old-'))
    const newRoot = await mkdtemp(join(tmpdir(), 'ws-new-'))

    await writeFile(join(newRoot, 'new.ts'), 'export const x = 1')

    const fileService = new FileService(oldRoot)

    // 模拟 config:set 切换 cwd 时的行为
    const cwd = newRoot
    fileService.setRoot(cwd)
    win.send('workspace:changed', { cwd })

    const result = await fileService.read(join(newRoot, 'new.ts'))
    expect(result.content).toBe('export const x = 1')

    expect(win.sent).toHaveLength(1)
    expect(win.sent[0].channel).toBe('workspace:changed')
    expect(win.sent[0].payload).toEqual({ cwd: newRoot })

    await rm(oldRoot, { recursive: true, force: true }).catch(() => {})
    await rm(newRoot, { recursive: true, force: true }).catch(() => {})
  })
})

describe('workspace handler integration', () => {
  let dir = ''
  let fileService: FileService
  let workspaceStore: WorkspaceStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ws-handler-'))
    fileService = new FileService(dir)
    workspaceStore = new WorkspaceStore(join(dir, 'workspaces.json'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  // 模拟 workspace:open handler 的行为
  async function openWorkspace(path: string) {
    fileService.setRoot(path)
    const ws = await workspaceStore.upsert(path)
    await workspaceStore.addOpen(ws.id)
    await workspaceStore.setActive(ws.id)
    return ws
  }

  // 模拟 workspace:switch handler 的行为
  async function switchWorkspace(id: string) {
    const { workspaces } = await workspaceStore.list()
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) throw new Error(`workspace not found: ${id}`)
    fileService.setRoot(ws.path)
    await workspaceStore.setActive(id)
    return workspaceStore.getState(id)
  }

  it('打开工作区后持久化为 active/open', async () => {
    const path = join(dir, 'project-a')
    const ws = await openWorkspace(path)

    const result = await workspaceStore.list()
    expect(result.activeId).toBe(ws.id)
    expect(result.openIds).toContain(ws.id)
  })

  it('切换工作区时读取对应视图状态', async () => {
    const a = await openWorkspace(join(dir, 'project-a'))
    const b = await openWorkspace(join(dir, 'project-b'))

    await workspaceStore.updateState(a.id, { activeSessionId: 's-a' })
    await workspaceStore.updateState(b.id, { activeSessionId: 's-b' })

    const state = await switchWorkspace(a.id)
    expect(state.activeSessionId).toBe('s-a')

    const result = await workspaceStore.list()
    expect(result.activeId).toBe(a.id)
  })

  it('关闭工作区后自动切换 active', async () => {
    const a = await openWorkspace(join(dir, 'project-a'))
    const b = await openWorkspace(join(dir, 'project-b'))

    await workspaceStore.removeOpen(a.id)
    const result = await workspaceStore.list()
    expect(result.openIds).not.toContain(a.id)
    expect(result.activeId).toBe(b.id)
  })
})
