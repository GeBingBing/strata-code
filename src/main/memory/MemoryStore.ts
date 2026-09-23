import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { MemoryEntry } from '@shared/types'

interface StoreFile {
  version: 1
  entries: MemoryEntry[]
}

/**
 * 记忆库 —— userData/memory.json 的原子读写（spec: memory-core）。
 *
 * 与 SessionStore 同模式（懒加载缓存、损坏/缺失容错回空、tmp+rename 原子写），
 * 额外差异：蒸馏器（后台子循环）与 list/delete 可能并发访问，
 * 写操作经 promise 链互斥串行化（AC-3）。
 */
export class MemoryStore {
  private cache: MemoryEntry[] | null = null
  /** 串行化 load→mutate→persist 整个临界区（AC-3：并发写不丢更新） */
  private chain: Promise<unknown> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  /** 全部条目（按 updatedAt 降序） */
  async list(): Promise<MemoryEntry[]> {
    return this.enqueue(async () => {
      await this.load()
      return [...this.cache!].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }

  /** 创建或更新条目（按 id；更新保留 createdAt）（AC-2） */
  async upsert(entry: MemoryEntry): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      const idx = this.cache!.findIndex((e) => e.id === entry.id)
      if (idx >= 0) {
        this.cache![idx] = { ...entry, createdAt: this.cache![idx].createdAt }
      } else {
        this.cache!.push(entry)
      }
      await this.persist()
    })
  }

  async delete(id: string): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      const idx = this.cache!.findIndex((e) => e.id === id)
      if (idx >= 0) {
        this.cache!.splice(idx, 1)
        await this.persist()
      }
    })
  }

  /** 整批原子替换（蒸馏器批量提交）（AC-8） */
  async replace(entries: MemoryEntry[]): Promise<void> {
    await this.enqueue(async () => {
      await this.load()
      this.cache = [...entries]
      await this.persist()
    })
  }

  /** 把操作排入串行队列；失败不阻断后续操作 */
  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.chain.then(op, op)
    this.chain = run.catch(() => undefined)
    return run
  }

  /** 损坏/缺失文件 → 空库（AC-1）。仅应在 enqueue 临界区内调用 */
  private async load(): Promise<void> {
    if (this.cache) return
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as StoreFile
      this.cache = Array.isArray(parsed.entries) ? parsed.entries : []
    } catch {
      this.cache = []
    }
  }

  /** 原子写：tmp + rename（仅临界区内调用） */
  private async persist(): Promise<void> {
    const data: StoreFile = { version: 1, entries: this.cache! }
    const tmp = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, this.filePath)
  }
}

/** 生成记忆 id：`${kind}-${createdAt36}-${rand4}`（无第三方依赖） */
export function memoryId(kind: MemoryEntry['kind'], createdAt: number): string {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `${kind}-${createdAt.toString(36)}-${rand}`
}
