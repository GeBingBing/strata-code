import { describe, expect, it } from 'vitest'
import {
  buildDistillPrompt,
  extractJson,
  truncateMiddle,
  validateDrafts
} from '../../../src/main/memory/distillPrompt'
import type { MemoryEntry } from '@shared/types'

/** spec: memory-distillation —— 蒸馏 prompt 纯函数 */

describe('truncateMiddle', () => {
  it('未超长原样返回', () => {
    expect(truncateMiddle('short text', 100)).toBe('short text')
  })

  it('超长 → 保留头尾去中段，总长受限', () => {
    const long = 'a'.repeat(1000) + 'MIDDLE' + 'b'.repeat(1000)
    const out = truncateMiddle(long, 200)
    expect(out.length).toBeLessThanOrEqual(250) // 截断标记余量
    expect(out.startsWith('a')).toBe(true)
    expect(out.endsWith('b')).toBe(true)
    expect(out).not.toContain('MIDDLE')
    expect(out).toContain('…') // 截断标记
  })
})

describe('buildDistillPrompt', () => {
  it('含转录文本与现有条目（带 id 供 retire）', () => {
    const existing: MemoryEntry[] = [
      {
        id: 'e1',
        kind: 'preference',
        scope: 'global',
        cwd: null,
        content: 'User prefers Chinese replies.',
        confidence: 0.8,
        hits: 2,
        tags: ['language'],
        sourceSessionId: 's-old',
        createdAt: 1,
        updatedAt: 2
      }
    ]
    const prompt = buildDistillPrompt('USER: hello\nASSISTANT: hi', existing)
    expect(prompt).toContain('hello')
    expect(prompt).toContain('e1')
    expect(prompt).toContain('User prefers Chinese replies.')
    expect(prompt).toContain('JSON')
  })
})

describe('extractJson', () => {
  it('直接 JSON 文本', () => {
    expect(extractJson('{"add": []}')).toEqual({ add: [] })
  })

  it('剥 ```json 栅栏', () => {
    expect(extractJson('```json\n{"add": []}\n```')).toEqual({ add: [] })
  })

  it('前后有噪声文本 → 首个平衡对象', () => {
    expect(extractJson('Here you go: {"add": [{"kind": "fact"}]} hope it helps')).toEqual({
      add: [{ kind: 'fact' }]
    })
  })

  it('无 JSON → null', () => {
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson('{"unbalanced": ')).toBeNull()
  })
})

describe('validateDrafts', () => {
  const NOW = 1000

  it('丢非法 kind；合法条目补默认字段', () => {
    const raw = {
      add: [
        { kind: 'fact', scope: 'global', content: 'valid fact', tags: ['x'] },
        { kind: 'nonsense', content: 'bad kind' },
        { content: 'missing kind' }
      ],
      retire: []
    }
    const { add } = validateDrafts(raw, 's-1', NOW)
    expect(add).toHaveLength(1)
    expect(add[0]).toMatchObject({
      kind: 'fact',
      scope: 'global',
      content: 'valid fact',
      confidence: 0.6,
      hits: 0,
      sourceSessionId: 's-1'
    })
    expect(add[0].id).toBeTruthy()
  })

  it('钳制 content ≤500 与 confidence ∈ [0,1]', () => {
    const raw = {
      add: [
        { kind: 'fact', scope: 'global', content: 'x'.repeat(600), confidence: 5, tags: [] },
        { kind: 'lesson', scope: 'global', content: 'ok', confidence: -2, tags: [] }
      ],
      retire: []
    }
    const { add } = validateDrafts(raw, 's-1', NOW)
    expect(add[0].content.length).toBe(500)
    expect(add[0].confidence).toBeLessThanOrEqual(1)
    expect(add[1].confidence).toBeGreaterThanOrEqual(0)
  })

  it('非法输入（null/数组/缺字段）→ 空结果', () => {
    expect(validateDrafts(null, 's', NOW)).toEqual({ add: [], retire: [] })
    expect(validateDrafts('nope', 's', NOW)).toEqual({ add: [], retire: [] })
    expect(validateDrafts({ add: 'not-array' }, 's', NOW)).toEqual({ add: [], retire: [] })
  })

  it('retire 只保留字符串 id', () => {
    const raw = { add: [], retire: ['e1', 42, null] }
    expect(validateDrafts(raw, 's', NOW).retire).toEqual(['e1'])
  })
})
