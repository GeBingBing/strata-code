import type { MentionAttachment } from '@shared/types'
import { FileService } from './files/fileService'

const MAX_TOTAL_CHARS = 128 * 1024 // 128KB prompt 上限

/**
 * 把用户提及的附件组装成 prompt 文本（spec: file-context-mentions）。
 * 文件超出大小或二进制时只保留元数据。
 */
export async function assembleContext(
  text: string,
  attachments: MentionAttachment[],
  fileService: FileService
): Promise<string> {
  const seen = new Set<string>()
  const parts: string[] = []
  if (text.trim()) parts.push(text.trim())

  for (const a of attachments) {
    if (seen.has(a.id)) continue
    seen.add(a.id)

    if (a.type === 'folder') {
      const folderContent = await readFolder(a.path, fileService)
      parts.push(`\n--- Folder: ${a.path} ---\n${folderContent}`)
    } else {
      const content = await readFile(a.path, a.range, fileService)
      parts.push(`\n--- File: ${a.path}${rangeLabel(a.range)} ---\n${content}`)
    }

    const newTotal = parts.reduce((sum, p) => sum + p.length, 0)
    if (newTotal > MAX_TOTAL_CHARS) {
      parts.push('\n...(context truncated due to length limit)')
      break
    }
  }

  return parts.join('\n')
}

function rangeLabel(range?: MentionAttachment['range']): string {
  if (!range) return ''
  return ` (lines ${range.startLine}-${range.endLine})`
}

async function readFile(path: string, range: MentionAttachment['range'], fileService: FileService): Promise<string> {
  try {
    const file = await fileService.read(path)
    if (file.isBinary) {
      return `[binary file: ${path}, size: ${file.size} bytes]`
    }
    if (file.isTooLarge) {
      return `[file too large: ${path}, size: ${file.size} bytes]`
    }

    let content = file.content
    if (range) {
      const lines = content.split('\n')
      const start = Math.max(0, range.startLine - 1)
      const end = Math.max(start, Math.min(lines.length, range.endLine))
      content = lines.slice(start, end).join('\n')
    }

    return content
  } catch (err) {
    return `[unable to read: ${path}${err instanceof Error ? ` — ${err.message}` : ''}]`
  }
}

async function readFolder(path: string, fileService: FileService): Promise<string> {
  try {
    const nodes = await fileService.list(path, 10)
    const files = collectFiles(nodes, path)
    const contents: string[] = []
    for (const f of files) {
      const content = await readFile(f, undefined, fileService)
      contents.push(`--- ${f} ---\n${content}`)
    }
    return contents.join('\n\n')
  } catch (err) {
    return `[unable to list folder: ${path}${err instanceof Error ? ` — ${err.message}` : ''}]`
  }
}

function collectFiles(nodes: import('@shared/types').FileNode[], base: string): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.isDirectory && n.children) {
      out.push(...collectFiles(n.children, base))
    } else if (!n.isDirectory) {
      out.push(n.path)
    }
  }
  return out
}
