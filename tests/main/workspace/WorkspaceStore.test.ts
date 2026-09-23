import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceStore, workspaceId } from '../../../src/main/workspace/WorkspaceStore'

/** spec: workspace-management AC-1/2/3/4/5 —— WorkspaceStore 持久化与状态管理 */

let dir = ''
let store: WorkspaceStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ws-store-'))
  store = new WorkspaceStore(join(dir, 'workspaces.json'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {})
});

describe('WorkspaceStore', () => {
  it('空存储返回空列表', async () => {
    const result = await store.list()
    expect(result.workspaces).toEqual([])
    expect(result.openIds).toEqual([])
    expect(result.activeId).toBeNull()
  })

  it('upsert 创建 workspace 并返回', async () => {
    const ws = await store.upsert('/Users/me/project-a')
    expect(ws.path).toBe('/Users/me/project-a')
    expect(ws.name).toBe('project-a')
    expect(ws.id).toBe(workspaceId('/Users/me/project-a'))

    const result = await store.list()
    expect(result.workspaces).toHaveLength(1)
    expect(result.workspaces[0].path).toBe('/Users/me/project-a')
  })

  it('upsert 重复 path 时复用并更新 lastOpenedAt', async () => {
    const first = await store.upsert('/Users/me/project-a')
    const second = await store.upsert('/Users/me/project-a')
    expect(second.id).toBe(first.id)

    const result = await store.list()
    expect(result.workspaces).toHaveLength(1)
    expect(result.workspaces[0].lastOpenedAt).toBeGreaterThanOrEqual(first.lastOpenedAt)
  })

  it('addOpen / removeOpen 管理打开列表', async () => {
    const ws = await store.upsert('/Users/me/project-a')
    await store.addOpen(ws.id)

    let result = await store.list()
    expect(result.openIds).toContain(ws.id)

    await store.removeOpen(ws.id)
    result = await store.list()
    expect(result.openIds).not.toContain(ws.id)
  })

  it('removeOpen 关闭 active 时自动选择下一个', async () => {
    const a = await store.upsert('/Users/me/project-a')
    const b = await store.upsert('/Users/me/project-b')
    await store.addOpen(a.id)
    await store.addOpen(b.id)
    await store.setActive(a.id)

    await store.removeOpen(a.id)
    const result = await store.list()
    expect(result.activeId).toBe(b.id)
  })

  it('setActive 保存活跃工作区', async () => {
    const ws = await store.upsert('/Users/me/project-a')
    await store.setActive(ws.id)

    const result = await store.list()
    expect(result.activeId).toBe(ws.id)
    expect(result.openIds).toContain(ws.id)
  })

  it('updateState / getState 保存与读取视图状态', async () => {
    const ws = await store.upsert('/Users/me/project-a')
    await store.updateState(ws.id, { activeSessionId: 's1', openFilePaths: ['/a.ts'] })

    const state = await store.getState(ws.id)
    expect(state).toEqual({ activeSessionId: 's1', openFilePaths: ['/a.ts'] })
  })

  it('持久化后重新加载恢复状态', async () => {
    const ws = await store.upsert('/Users/me/project-a')
    await store.addOpen(ws.id)
    await store.setActive(ws.id)
    await store.updateState(ws.id, { activeSessionId: 's1' })

    const store2 = new WorkspaceStore(join(dir, 'workspaces.json'))
    const result = await store2.list()
    expect(result.workspaces).toHaveLength(1)
    expect(result.openIds).toEqual([ws.id])
    expect(result.activeId).toBe(ws.id)
    expect(await store2.getState(ws.id)).toEqual({ activeSessionId: 's1' })
  })

  it('损坏文件回退为空存储', async () => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(join(dir, 'workspaces.json'), 'not json')
    const result = await store.list()
    expect(result.workspaces).toEqual([])
  })
})
