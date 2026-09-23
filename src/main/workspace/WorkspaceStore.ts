import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'
import type { Workspace, WorkspaceViewState } from '@shared/types'

interface StoreFile {
  version: 1
  workspaces: Workspace[]
  openWorkspaceIds: string[]
  activeWorkspaceId: string | null
  /** workspaceId → view state */
  viewStates: Record<string, WorkspaceViewState>
}

const EMPTY: StoreFile = {
  version: 1,
  workspaces: [],
  openWorkspaceIds: [],
  activeWorkspaceId: null,
  viewStates: {}
}

/** 从路径生成稳定 id（spec: workspace-management） */
export function workspaceId(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 16)
}

function workspaceFromPath(path: string): Workspace {
  return {
    id: workspaceId(path),
    path,
    name: basename(path) || path,
    lastOpenedAt: Date.now()
  }
}

/**
 * 工作区持久化存储（spec: workspace-management）。
 * 模式与 SessionStore 一致：懒加载缓存、损坏/缺失容错、tmp+rename 原子写。
 */
export class WorkspaceStore {
  private cache: StoreFile | null = null
  /** 串行化写操作，避免并发 rename tmp 竞争 */
  private chain: Promise<unknown> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async list(): Promise<{ workspaces: Workspace[]; openIds: string[]; activeId: string | null }> {
    return this.enqueue(async () => {
      await this.load()
      return {
        workspaces: [...this.cache!.workspaces].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
        openIds: [...this.cache!.openWorkspaceIds],
        activeId: this.cache!.activeWorkspaceId
      }
    })
  }

  /** 创建或更新 workspace，并更新 lastOpenedAt */
  async upsert(path: string): Promise<Workspace> {
    return this.enqueue(async () => {
      await this.load()
      const id = workspaceId(path)
      const existing = this.cache!.workspaces.find((w) => w.id === id)
      const workspace = workspaceFromPath(path)
      if (existing) {
        existing.lastOpenedAt = workspace.lastOpenedAt
        existing.name = workspace.name
      } else {
        this.cache!.workspaces.push(workspace)
      }
      await this.persist()
      return existing ? { ...existing } : workspace
    })
  }

  async addOpen(id: string): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      if (!this.cache!.openWorkspaceIds.includes(id)) {
        this.cache!.openWorkspaceIds.push(id)
      }
      await this.persist()
    })
  }

  async removeOpen(id: string): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      this.cache!.openWorkspaceIds = this.cache!.openWorkspaceIds.filter((x) => x !== id)
      if (this.cache!.activeWorkspaceId === id) {
        this.cache!.activeWorkspaceId = this.cache!.openWorkspaceIds[this.cache!.openWorkspaceIds.length - 1] ?? null
      }
      await this.persist()
    })
  }

  async setActive(id: string | null): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      this.cache!.activeWorkspaceId = id
      if (id && !this.cache!.openWorkspaceIds.includes(id)) {
        this.cache!.openWorkspaceIds.push(id)
      }
      await this.persist()
    })
  }

  async updateState(id: string, state: Partial<WorkspaceViewState>): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      const current = this.cache!.viewStates[id] ?? {}
      this.cache!.viewStates[id] = { ...current, ...state }
      await this.persist()
    })
  }

  async getState(id: string): Promise<WorkspaceViewState> {
    return this.enqueue(async () => {
      await this.load()
      return { ...(this.cache!.viewStates[id] ?? {}) }
    })
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.chain.then(op, op)
    this.chain = run.catch(() => undefined)
    return run
  }

  private async load(): Promise<void> {
    if (this.cache) return
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as StoreFile
      this.cache = {
        version: 1,
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        openWorkspaceIds: Array.isArray(parsed.openWorkspaceIds) ? parsed.openWorkspaceIds : [],
        activeWorkspaceId: typeof parsed.activeWorkspaceId === 'string' ? parsed.activeWorkspaceId : null,
        viewStates: parsed.viewStates && typeof parsed.viewStates === 'object' ? parsed.viewStates : {}
      }
    } catch {
      this.cache = structuredClone(EMPTY)
    }
  }

  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    const data = JSON.stringify(this.cache, null, 2)
    await fs.writeFile(tmp, data, 'utf-8')
    await fs.rename(tmp, this.filePath)
  }
}
