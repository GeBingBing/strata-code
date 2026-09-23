import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SearchResult } from '@shared/types'

const MAX_RESULTS = 200
const MAX_FILE_BYTES = 1 * 1024 * 1024 // 1MB
const BINARY_SNIFF_BYTES = 4096

export class SearchService {
  /** 简单文本搜索 —— 跳过 node_modules/.git/二进制/过大文件 */
  async search(root: string, query: string): Promise<SearchResult[]> {
    if (!query) return []
    const out: SearchResult[] = []
    await walk(root, '', query, out)
    return out.slice(0, MAX_RESULTS)
  }
}

async function walk(
  root: string,
  rel: string,
  query: string,
  out: SearchResult[]
): Promise<void> {
  if (out.length >= MAX_RESULTS) return
  const abs = rel ? join(root, rel) : root
  let entries
  try {
    entries = await readdir(abs, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= MAX_RESULTS) return
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const childRel = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) {
      await walk(root, childRel, query, out)
    } else {
      await searchFile(root, childRel, query, out)
    }
  }
}

async function searchFile(
  root: string,
  rel: string,
  query: string,
  out: SearchResult[]
): Promise<void> {
  const abs = join(root, rel)
  let content: string
  try {
    const buf = await readFile(abs)
    if (buf.length > MAX_FILE_BYTES) return
    // 二进制嗅探
    const sniffLen = Math.min(buf.length, BINARY_SNIFF_BYTES)
    for (let i = 0; i < sniffLen; i++) {
      if (buf[i] === 0) return
    }
    content = buf.toString('utf-8')
  } catch {
    return
  }

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(query)) {
      const preview = lines[i].trim().slice(0, 120)
      out.push({ path: rel, line: i + 1, preview })
      if (out.length >= MAX_RESULTS) return
    }
  }
}
