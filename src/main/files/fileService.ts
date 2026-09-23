import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { FileContent, FileNode } from '@shared/types'

/**
 * 文件系统服务（编辑器功能）。
 * 安全：所有路径必须落在 root 之内（防止越权访问）。
 */

/** 超过此字节数不读全文，返回元数据让 UI 显示「文件过大」 */
const MAX_INLINE_BYTES = 1 * 1024 * 1024 // 1MB
/** 二进制检测采样字节数 */
const BINARY_SNIFF_BYTES = 8192

export class FileService {
  private root: string

  constructor(root: string) {
    this.root = root
  }

  setRoot(root: string): void {
    this.root = root
  }

  getRoot(): string {
    return this.root
  }

  private guard(p: string): string {
    // 相对路径以 root 为锚点（不能用 process.cwd()，否则 workspace 切换后会越界）
    const abs = resolve(this.root, p)
    const rootAbs = resolve(this.root)
    const rel = relative(rootAbs, abs)
    if (rel.startsWith('..') || rel === '..' || abs !== join(rootAbs, rel)) {
      throw new Error(`path escapes root: ${p}`)
    }
    return abs
  }

  async list(path: string, depth = 2): Promise<FileNode[]> {
    const abs = this.guard(path)
    return this.listRecursive(abs, depth)
  }

  private async listRecursive(dir: string, remainingDepth: number): Promise<FileNode[]> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const out: FileNode[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const abs = join(dir, entry.name)
      const node: FileNode = {
        name: entry.name,
        path: abs,
        isDirectory: entry.isDirectory()
      }
      if (entry.isDirectory() && remainingDepth > 0) {
        node.children = await this.listRecursive(abs, remainingDepth - 1)
      }
      out.push(node)
    }
    out.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return out
  }

  async read(path: string): Promise<FileContent> {
    const abs = this.guard(path)
    const st = await stat(abs)
    const mtime = st.mtimeMs
    const size = st.size
    const isTooLarge = size > MAX_INLINE_BYTES

    let content = ''
    let isBinary = false

    if (!isTooLarge) {
      const buf = await readFile(abs)
      // 嗅探二进制：在前 BINARY_SNIFF_BYTES 中查找空字节
      const sniffLen = Math.min(buf.length, BINARY_SNIFF_BYTES)
      for (let i = 0; i < sniffLen; i++) {
        if (buf[i] === 0) {
          isBinary = true
          break
        }
      }
      if (!isBinary) {
        content = buf.toString('utf-8')
      }
    }

    return { content, size, mtime, isBinary, isTooLarge }
  }

  async write(path: string, content: string): Promise<void> {
    const abs = this.guard(path)
    await writeFile(abs, content, 'utf-8')
  }

  async create(path: string, content = ''): Promise<void> {
    const abs = this.guard(path)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf-8')
  }

  async mkdirDir(path: string): Promise<void> {
    const abs = this.guard(path)
    await mkdir(abs, { recursive: true })
  }

  async renamePath(from: string, to: string): Promise<void> {
    const absFrom = this.guard(from)
    const absTo = this.guard(to)
    await rename(absFrom, absTo)
  }

  async deletePath(path: string): Promise<void> {
    const abs = this.guard(path)
    await rm(abs, { recursive: true, force: true })
  }

  async exists(path: string): Promise<boolean> {
    try {
      const abs = this.guard(path)
      await stat(abs)
      return true
    } catch {
      return false
    }
  }

  isWithinRoot(target: string): boolean {
    try {
      this.guard(target)
      return true
    } catch {
      return false
    }
  }

  get separator(): string {
    return sep
  }
}
