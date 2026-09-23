import { describe, expect, it } from 'vitest'
import { mergeEntries, normalizeContent, prune, similarity } from '../../../src/main/memory/merge'
import type { MemoryEntry } from '@shared/types'
import { makeEntry } from './MemoryStore.test'

/** spec: memory-core AC-4/5/6/7 */

const NOW = 1_000_000

describe('normalizeContent', () => {
  it('trim + 空白折叠', () => {
    expect(normalizeContent('  User   prefers\nTypeScript  ')).toBe('User prefers TypeScript')
  })
})

describe('similarity', () => {
  it('完全相同 → 1；无交集 → 0；部分重叠 → (0,1)', () => {
    expect(similarity('a b c', 'a b c')).toBe(1)
    expect(similarity('a b', 'c d')).toBe(0)
    expect(similarity('a b c', 'a b d')).toBe(2 / 4)
  })
})

describe('mergeEntries', () => {
  it('AC-4: 精确重复（normalize 相等）→ 合并且字段演化正确', () => {
    const existing = [makeEntry({ id: 'e1', content: 'User prefers TypeScript.', confidence: 0.6, hits: 0, tags: ['ts'], createdAt: 111, updatedAt: 111 })]
    const incoming = [makeEntry({ id: 'n1', content: 'User  prefers TypeScript.', confidence: 0.7, tags: ['ts', 'style'], createdAt: NOW, updatedAt: NOW })]

    const result = mergeEntries(existing, incoming, [], NOW)
    expect(result.entries).toHaveLength(1)
    expect(result.added).toBe(0)
    expect(result.updated).toBe(1)
    const merged = result.entries[0]
    // 保留原 id 与 createdAt；confidence +0.15；hits +1；tags 并集；updatedAt 刷新
    expect(merged.id).toBe('e1')
    expect(merged.createdAt).toBe(111)
    expect(merged.confidence).toBeCloseTo(0.75)
    expect(merged.hits).toBe(1)
    expect(merged.tags.sort()).toEqual(['style', 'ts'])
    expect(merged.updatedAt).toBe(NOW)
  })

  it('AC-4: Jaccard ≥ 0.8 近重复 → 合并；保留更长 content', () => {
    const long = 'User prefers concise TypeScript answers with strict mode enabled always.'
    const existing = [makeEntry({ id: 'e1', kind: 'preference', content: long, confidence: 0.9 })]
    // 与 existing 高度重叠（相同 token 大部分保留，追加少量）
    const incoming = [makeEntry({ id: 'n1', kind: 'preference', content: `${long} Really.` })]

    const result = mergeEntries(existing, incoming, [], NOW)
    expect(result.entries).toHaveLength(1)
    expect(result.updated).toBe(1)
    expect(result.entries[0].content).toBe(`${long} Really.`) // 保留更长的一方（incoming）
  })

  it('AC-4: confidence 合并上限 0.99', () => {
    const existing = [makeEntry({ id: 'e1', confidence: 0.95, content: 'x y z w' })]
    const incoming = [makeEntry({ id: 'n1', confidence: 0.95, content: 'x y z w' })]
    const result = mergeEntries(existing, incoming, [], NOW)
    expect(result.entries[0].confidence).toBe(0.99)
  })

  it('AC-5: Jaccard < 0.8 → 两条并存；跨 kind / 跨 cwd 不合并', () => {
    const existing = [
      makeEntry({ id: 'e1', content: 'alpha beta gamma delta epsilon' }),
      makeEntry({ id: 'e2', kind: 'preference', content: 'User prefers TypeScript.' }),
      makeEntry({ id: 'e3', scope: 'project', cwd: '/a', content: 'Project uses vitest.' })
    ]
    const incoming = [
      makeEntry({ id: 'n1', content: 'zeta eta theta iota kappa' }),          // 无重叠
      makeEntry({ id: 'n2', kind: 'fact', content: 'User prefers TypeScript.' }), // 跨 kind
      makeEntry({ id: 'n3', scope: 'project', cwd: '/b', content: 'Project uses vitest.' }) // 跨 cwd
    ]

    const result = mergeEntries(existing, incoming, [], NOW)
    expect(result.entries).toHaveLength(6)
    expect(result.added).toBe(3)
    expect(result.updated).toBe(0)
  })

  it('AC-6: retireIds 移除对应条目并计数；未知 id 忽略', () => {
    const existing = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    const result = mergeEntries(existing, [], ['e1', 'nope'], NOW)
    expect(result.entries.map((e) => e.id)).toEqual(['e2'])
    expect(result.retired).toBe(1)
  })

  it('id 相等直接命中合并（即使内容已改写）', () => {
    const existing = [makeEntry({ id: 'e1', content: 'old wording alpha beta', hits: 3 })]
    const incoming = [makeEntry({ id: 'e1', content: 'completely rewritten delta' })]
    const result = mergeEntries(existing, incoming, [], NOW)
    expect(result.entries).toHaveLength(1)
    expect(result.updated).toBe(1)
    expect(result.entries[0].hits).toBe(4)
    expect(result.entries[0].content).toBe('completely rewritten delta')
  })
})

describe('prune', () => {
  const caps = { fact: 2, preference: 1, lesson: 30, skill: 30 }

  function entries(kind: MemoryEntry['kind'], conf: number[], age: number[]): MemoryEntry[] {
    return conf.map((c, i) => makeEntry({ id: `${kind}-${i}`, kind, confidence: c, updatedAt: NOW - age[i] }))
  }

  it('AC-7: 超上限按 confidence×recency 升序淘汰', () => {
    // fact: 3 条超上限 2 —— 淘汰低分或陈旧者
    const facts = entries('fact', [0.9, 0.5, 0.9], [100, 100, 100_000]) // 第三条高 confidence 但极陈旧
    const prefs = entries('preference', [0.8, 0.9], [0, 0])            // preference 2 条超上限 1
    const kept = prune([...facts, ...prefs], caps)

    expect(kept.filter((e) => e.kind === 'fact')).toHaveLength(2)
    expect(kept.filter((e) => e.kind === 'preference')).toHaveLength(1)
    // fact-1（低 confidence）被淘汰；fact-2（陈旧）被淘汰；保留 fact-0 与二者中较优者
    const factIds = kept.filter((e) => e.kind === 'fact').map((e) => e.id)
    expect(factIds).not.toContain('fact-1')
    // preference 保留高 confidence 的那条
    expect(kept.find((e) => e.kind === 'preference')?.id).toBe('preference-1')
  })

  it('未超上限时原样返回', () => {
    const list = entries('fact', [0.5, 0.5], [0, 0])
    expect(prune(list, caps)).toHaveLength(2)
  })
})
