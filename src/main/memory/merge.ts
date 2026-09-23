import type { MemoryEntry, MemoryKind } from '@shared/types'

/**
 * 记忆巩固纯函数（spec: memory-core）—— 蒸馏 LLM 只提案，确定性函数决定合并/淘汰。
 * 无 I/O、无时间依赖（now 由调用方传入），全部可单测。
 */

/** trim + 空白折叠（仅比较用，不落盘） */
export function normalizeContent(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}

/** token 集合（小写化，按空白切分） */
function tokens(s: string): Set<string> {
  return new Set(normalizeContent(s).toLowerCase().split(/\s+/).filter(Boolean))
}

/** token 集 Jaccard 相似度 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

/** 同 kind 且同有效作用域（project 时 cwd 相等）才允许合并（AC-5） */
function sameBucket(a: MemoryEntry, b: MemoryEntry): boolean {
  if (a.kind !== b.kind) return false
  if (a.scope !== b.scope) return false
  if (a.scope === 'project' && a.cwd !== b.cwd) return false
  return true
}

/** 命中规则：id 相等 / 规范化相等 / Jaccard ≥ 0.8（AC-4） */
function matches(existing: MemoryEntry, incoming: MemoryEntry): boolean {
  if (existing.id === incoming.id) return true
  if (normalizeContent(existing.content) === normalizeContent(incoming.content)) return true
  return similarity(existing.content, incoming.content) >= 0.8
}

export interface MergeResult {
  entries: MemoryEntry[]
  added: number
  updated: number
  retired: number
}

/**
 * 合并蒸馏提案：匹配 → 合并（保留更长 content、confidence +0.15 上限 0.99、
 * hits +1、tags 并集、updatedAt 刷新）；retireIds 移除（AC-6）。
 */
export function mergeEntries(
  existing: MemoryEntry[],
  incoming: MemoryEntry[],
  retireIds: string[],
  now: number
): MergeResult {
  const retireSet = new Set(retireIds)
  let retired = 0
  // 先移除待淘汰条目
  const entries: MemoryEntry[] = existing.filter((e) => {
    if (retireSet.has(e.id)) {
      retired++
      return false
    }
    return true
  })

  let added = 0
  let updated = 0

  for (const draft of incoming) {
    const hit = entries.find((e) => sameBucket(e, draft) && matches(e, draft))
    if (hit) {
      const merged: MemoryEntry = {
        ...hit,
        // 保留更长 content（信息量更大）
        content: draft.content.length > hit.content.length ? draft.content : hit.content,
        confidence: Math.min(0.99, hit.confidence + 0.15),
        hits: hit.hits + 1,
        tags: [...new Set([...hit.tags, ...draft.tags])],
        sourceSessionId: draft.sourceSessionId,
        updatedAt: now
      }
      const idx = entries.indexOf(hit)
      entries[idx] = merged
      updated++
    } else {
      entries.push({ ...draft })
      added++
    }
  }

  return { entries, added, updated, retired }
}

/** 默认每 kind 条目上限 */
export const DEFAULT_CAPS: Record<MemoryKind, number> = {
  fact: 50,
  preference: 30,
  lesson: 30,
  skill: 20
}

/** 新近度半衰期：30 天 */
const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000

function score(entry: MemoryEntry, now: number): number {
  const age = Math.max(0, now - entry.updatedAt)
  return entry.confidence * Math.exp(-age / HALF_LIFE_MS)
}

/** 超上限按 confidence × recency 升序淘汰（AC-7） */
export function prune(
  entries: MemoryEntry[],
  caps: Partial<Record<MemoryKind, number>> = DEFAULT_CAPS
): MemoryEntry[] {
  const now = entries.reduce((m, e) => Math.max(m, e.updatedAt), 0)
  const byKind = new Map<MemoryKind, MemoryEntry[]>()
  for (const e of entries) {
    const list = byKind.get(e.kind) ?? []
    list.push(e)
    byKind.set(e.kind, list)
  }
  const kept: MemoryEntry[] = []
  for (const [kind, list] of byKind) {
    const cap = caps[kind] ?? DEFAULT_CAPS[kind]
    if (list.length <= cap) {
      kept.push(...list)
    } else {
      // 分数高者优先保留
      const ranked = [...list].sort((a, b) => score(b, now) - score(a, now))
      kept.push(...ranked.slice(0, cap))
    }
  }
  // 保持原有相对顺序
  const keptSet = new Set(kept)
  return entries.filter((e) => keptSet.has(e))
}
