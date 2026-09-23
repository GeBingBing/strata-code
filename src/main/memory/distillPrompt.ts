import type { MemoryEntry, MemoryKind, MemoryScope } from '@shared/types'
import { memoryId } from './MemoryStore'

/**
 * 蒸馏 prompt 组装与解析纯函数（spec: memory-distillation）。
 * 无 I/O —— 全部可单测。
 */

const VALID_KINDS: MemoryKind[] = ['fact', 'preference', 'lesson', 'skill']
const VALID_SCOPES: MemoryScope[] = ['global', 'project']
export const MAX_CONTENT_CHARS = 500
/** 进 prompt 的现有候选条目上限（控成本） */
const MAX_EXISTING_IN_PROMPT = 20

/** 中段截断：保留头尾各一半，中段以 … 代替（AC-3） */
export function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const marker = '\n…[middle truncated]…\n'
  const budget = maxChars - marker.length
  const head = Math.floor(budget / 2)
  const tail = budget - head
  return text.slice(0, head) + marker + text.slice(text.length - tail)
}

/** 组装蒸馏 prompt：指令 + 现有候选条目（带 id）+ 截断转录（AC-4 的 prompt 侧） */
export function buildDistillPrompt(transcript: string, existing: MemoryEntry[]): string {
  const existingLines =
    existing.length > 0
      ? existing
          .slice(0, MAX_EXISTING_IN_PROMPT)
          .map((e) => `- [id=${e.id}] (${e.kind}) ${e.content}`)
          .join('\n')
      : '(none yet)'
  const transcriptBlock = truncateMiddle(transcript, 24_000)

  return `You are a memory distillation engine. Analyze the conversation transcript below and extract DURABLE knowledge for future sessions with this user.

Extract only:
- "fact": stable project/user facts that remain true across sessions
- "preference": how the user wants you to work (language, verbosity, style, tooling choices)
- "lesson": lessons learned from mistakes, corrections, or failures in this session
- "skill": reusable operational patterns (MUST include trigger keywords in "tags")

Existing memories (propose "retire" ids for entries that are now wrong/obsolete):
${existingLines}

Rules:
- Output STRICT JSON only, no prose, no code fences: {"add": [...], "retire": ["<id>"]}
- Each add item: {"kind": "fact"|"preference"|"lesson"|"skill", "scope": "global"|"project", "content": "<<=200 chars, in the user's language>", "confidence": <0..1>, "tags": ["<keyword>"]}
- Only add genuinely durable knowledge. If nothing is worth remembering, output {"add": [], "retire": []}.

Transcript:
${transcriptBlock}`
}

/** 提取首个平衡 JSON 对象：剥栅栏 → 找 { } 平衡段 → parse（AC-5 前置） */
export function extractJson(text: string): unknown | null {
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
  const start = stripped.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      if (inString) escaped = true
      continue
    }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(stripped.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export interface DistillDrafts {
  add: MemoryEntry[]
  retire: string[]
}

/** 窄校验：丢非法条目、钳制字段、补默认值（AC-5） */
export function validateDrafts(raw: unknown, sourceSessionId: string, now: number): DistillDrafts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { add: [], retire: [] }
  }
  const obj = raw as { add?: unknown; retire?: unknown }
  const add: MemoryEntry[] = []
  if (Array.isArray(obj.add)) {
    for (const item of obj.add) {
      if (!item || typeof item !== 'object') continue
      const d = item as Record<string, unknown>
      const kind = d.kind as MemoryKind
      if (!VALID_KINDS.includes(kind)) continue
      const scope = (VALID_KINDS.includes(kind) && VALID_SCOPES.includes(d.scope as MemoryScope)
        ? d.scope
        : 'global') as MemoryScope
      const content = typeof d.content === 'string' ? d.content.trim().slice(0, MAX_CONTENT_CHARS) : ''
      if (!content) continue
      const confidenceRaw = typeof d.confidence === 'number' ? d.confidence : 0.6
      const confidence = Math.min(1, Math.max(0, confidenceRaw))
      const tags = Array.isArray(d.tags)
        ? d.tags.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(0, 10)
        : []
      const createdAt = now
      add.push({
        id: memoryId(kind, createdAt),
        kind,
        scope,
        cwd: null,
        content,
        confidence,
        hits: 0,
        tags,
        sourceSessionId,
        createdAt,
        updatedAt: now
      })
    }
  }
  const retire = Array.isArray(obj.retire)
    ? obj.retire.filter((r): r is string => typeof r === 'string' && r.length > 0)
    : []
  return { add, retire }
}
