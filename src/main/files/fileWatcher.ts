import { EventEmitter } from 'node:events'
import { basename, join } from 'node:path'
import { existsSync } from 'node:fs'
import type { WatchListener } from 'node:fs'

interface FileWatcherOptions {
  /** 自身写入的路径在 suppressMs 内的同路径事件被丢弃 */
  suppressMs?: number
  /** 每个路径的合并去抖 */
  debounceMs?: number
  /** 监听路径过滤：跳过这些名字的文件/目录 */
  ignoreNames?: string[]
}

const DEFAULT_OPTIONS: Required<FileWatcherOptions> = {
  suppressMs: 750,
  debounceMs: 150,
  ignoreNames: ['node_modules', '.git', 'dist', 'out', '.next']
}

/**
 * 监听工作区目录变更并 emit `change`/`rename`（spec: file-watcher）。
 * 自写抑制：通过 `markOwnWrite(path)` 标记，避免自身 file:write 引发回声重载。
 */
export class FileWatcher extends EventEmitter {
  private root: string | null = null
  private watcher: ReturnType<typeof import('node:fs').watch> | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private recentWrites = new Map<string, number>()
  private readonly opts: Required<FileWatcherOptions>

  constructor(opts: FileWatcherOptions = {}) {
    super()
    this.opts = { ...DEFAULT_OPTIONS, ...opts }
  }

  watch(root: string): void {
    if (this.root === root && this.watcher) return
    this.dispose()
    this.root = root
    try {
      // dynamic require: 在测试或 Linux 降级路径下可控
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      this.watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename) return
        const path = String(filename)
        if (this.shouldIgnore(path)) return
        if (this.isOwnWrite(path)) return
        this.schedule(root, path)
      })
      this.watcher.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.warn('[file-watcher] error:', err.message)
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[file-watcher] watch failed:', (err as Error).message)
      this.watcher = null
    }
  }

  /** 主进程写入文件后调用，抑制同路径的回声事件。接受绝对或相对路径。 */
  markOwnWrite(path: string): void {
    const key = path.replace(/\\/g, '/').replace(/^\/+/, '')
    this.recentWrites.set(key, Date.now())
    // 抑制窗口过后清理
    setTimeout(() => {
      const ts = this.recentWrites.get(key)
      if (ts && Date.now() - ts >= this.opts.suppressMs) {
        this.recentWrites.delete(key)
      }
    }, this.opts.suppressMs + 100)
  }

  dispose(): void {
    for (const t of this.debounceTimers.values()) clearTimeout(t)
    this.debounceTimers.clear()
    this.recentWrites.clear()
    if (this.watcher) {
      try { this.watcher.close() } catch { /* ignore */ }
      this.watcher = null
    }
    this.root = null
  }

  private schedule(root: string, path: string): void {
    const key = `${root}::${path}`
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)
      // 过滤根目录自身的空/`.` 事件（macOS recursive watch 会在父级触发）
      if (!path || path === '.' || path === basename(root)) return
      // 跨平台：kind 通过文件是否存在判断，而非依赖 fs.watch 事件名（macOS 新建文件也返回 'rename'）
      const abs = join(root, path)
      const kind: 'change' | 'rename' = existsSync(abs) ? 'change' : 'rename'
      this.emit('change', { path: abs, kind })
    }, this.opts.debounceMs)
    this.debounceTimers.set(key, timer)
  }

  private shouldIgnore(path: string): boolean {
    // 归一化：去掉前导 './' 与 './'
    const norm = path.replace(/\\/g, '/').replace(/^\.\//, '')
    const parts = norm.split('/')
    for (const seg of parts) {
      if (this.opts.ignoreNames.includes(seg)) return true
      if (seg.startsWith('.') && seg.length > 1) return true
    }
    return false
  }

  private isOwnWrite(path: string): boolean {
    const key = path.replace(/\\/g, '/').replace(/^\/+/, '')
    const ts = this.recentWrites.get(key)
    if (!ts) return false
    if (Date.now() - ts > this.opts.suppressMs) {
      this.recentWrites.delete(key)
      return false
    }
    return true
  }
}

// 重新导出 basename 供测试断言使用（避免重复 import）
export const _basename = basename
// 允许测试桩：暴露 fs.watch 类型
export type { WatchListener }

