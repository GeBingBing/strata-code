import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import type { SessionSummary } from '@shared/types'

interface StoreFile {
  sessions: SessionSummary[]
}

/**
 * 会话索引 —— userData/sessions.json 的原子读写（spec: session-history）。
 * 完整转录由 SDK 自身持久化；这里只维护 {id, title, cwd, createdAt, updatedAt}。
 * spec: store-robustness —— 串行化 load→mutate→persist 临界区，避免并发 upsert/rename/delete
 * 在 tmp+rename 阶段的竞争（与 MemoryStore/WorkspaceStore 同模式）。
 */
export class SessionStore {
  private cache: SessionSummary[] | null = null
  private chain: Promise<unknown> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  /** 按 updatedAt 降序返回全部条目（AC-3） */
  list(): Promise<SessionSummary[]> {
    return this.enqueue(async () => {
      await this.load()
      return [...this.cache!].sort((a, b) => b.updatedAt - a.updatedAt)
    })
  }

  /** 创建或更新条目（AC-1/2） */
  upsert(summary: SessionSummary): Promise<void> {
    return this.enqueue(async () => {
      await this.load()
      const idx = this.cache!.findIndex((s) => s.id === summary.id)
      if (idx >= 0) {
        // 保留已有 createdAt；其余字段以传入为准
        this.cache![idx] = { ...summary, createdAt: this.cache![idx].createdAt }
      } else {
        this.cache!.push(summary)
      }
      await this.persist()
    })
  }

  rename(id: string, title: string): Promise<void> {
    return this.enqueue(async () => {
      await this.load()
      const entry = this.cache!.find((s) => s.id === id)
      if (entry) {
        entry.title = title
        entry.updatedAt = Date.now()
        await this.persist()
      }
    })
  }

  delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.load()
      const idx = this.cache!.findIndex((s) => s.id === id)
      if (idx >= 0) {
        this.cache!.splice(idx, 1)
        await this.persist()
      }
    })
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.chain.then(op, op)
    this.chain = run.catch(() => undefined)
    return run
  }

  /** 损坏/缺失文件 → 空索引（AC-6） */
  private async load(): Promise<void> {
    if (this.cache) return
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as StoreFile
      this.cache = Array.isArray(parsed.sessions) ? parsed.sessions : []
    } catch {
      this.cache = []
    }
  }

  /** 原子写：tmp + rename（AC-7） */
  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify({ sessions: this.cache }, null, 2), 'utf-8')
    await fs.rename(tmp, this.filePath)
  }
}

/** 便捷构造：从用户消息生成标题 */
export function titleFromFirstMessage(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine || 'New session'
}
