import { describe, expect, it } from 'vitest'
import { MemoryInjector } from '../../../src/main/memory/MemoryInjector'
import type { MemoryStore } from '../../../src/main/memory/MemoryStore'
import type { WebContentsLike } from '../../../src/main/ipc-interfaces'
import type { MemoryEntry } from '@shared/types'

/** spec: memory-injection AC-1~6 */

function createFakeWin() {
  const sent: Array<{ channel: string; payload: unknown }> = []
  const win: WebContentsLike = {
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload })
    },
    once: () => {},
    isDestroyed: () => false
  }
  return { win, sent }
}

function fakeStore(entries: MemoryEntry[]): MemoryStore {
  return {
    list: () => Promise.resolve([...entries])
  } as unknown as MemoryStore
}

const entry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: `e-${Math.random().toString(36).slice(2, 8)}`,
  kind: 'fact',
  scope: 'global',
  cwd: null,
  content: 'some fact',
  confidence: 0.6,
  hits: 0,
  tags: [],
  sourceSessionId: 's-1',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides
})

function injector(store: MemoryStore, currentSessionId: () => string | null = () => 's-live') {
  const { win, sent } = createFakeWin()
  const inj = new MemoryInjector({ store, win, currentSessionId })
  return { inj, win, sent }
}

describe('MemoryInjector', () => {
  it('AC-1: 空库 → 返回 "" 且不发事件', async () => {
    const { inj, sent } = injector(fakeStore([]))
    const append = await inj.buildAppend({ cwd: '/proj', firstText: 'hello' })
    expect(append).toBe('')
    expect(sent).toHaveLength(0)
  })

  it('AC-2: global 入选；project 同 cwd/父目录入选；无关 cwd 排除', async () => {
    const entries = [
      entry({ id: 'g1', content: 'global fact', tags: ['ts'] }),
      entry({ id: 'p1', scope: 'project', cwd: '/proj', content: 'same project', tags: ['ts'] }),
      entry({ id: 'p2', scope: 'project', cwd: '/proj/sub', content: 'sub project', tags: ['ts'] }),
      entry({ id: 'p3', scope: 'project', cwd: '/other', content: 'other project', tags: ['ts'] })
    ]
    const { inj, sent } = injector(fakeStore(entries))
    const append = await inj.buildAppend({ cwd: '/proj', firstText: 'ts question' })

    expect(append).toContain('global fact')
    expect(append).toContain('same project')
    // /proj 是 /proj/sub 的父目录 → 入选
    expect(append).toContain('sub project')
    expect(append).not.toContain('other project')
    expect(sent).toHaveLength(1)
  })

  it('AC-3: tag 重叠打分排序 + 条目/skill/字符上限', async () => {
    // 20 条普通 + 6 条 skill → 只取 12 + 4
    const many = Array.from({ length: 20 }, (_, i) =>
      entry({ id: `f${i}`, content: `fact number ${i} about vitest`, tags: ['vitest'], confidence: 0.5 + i * 0.01 })
    )
    const skills = Array.from({ length: 6 }, (_, i) =>
      entry({ id: `sk${i}`, kind: 'skill', content: `run skill ${i}`, tags: ['build'] })
    )
    const { inj } = injector(fakeStore([...many, ...skills]))
    const append = await inj.buildAppend({ cwd: '/proj', firstText: 'vitest question' })

    // 高 confidence 的 fact 优先（f11..f19 中前 12 条）
    expect(append).toContain('fact number 19')
    expect(append).not.toContain('fact number 0')
    // skill 上限 4
    expect(append).toContain('run skill 0')
    expect(append).not.toContain('run skill 5')
    // 事件只携带入选条目
    expect(append.length).toBeLessThanOrEqual(2000 + 400) // 模板开销余量
  })

  it('AC-4: 模板分区与 skill 行格式；空分区省略', async () => {
    const entries = [
      entry({ id: 'pref', kind: 'preference', content: 'User prefers concise answers.', tags: ['style'] }),
      entry({ id: 'sk', kind: 'skill', content: 'Run npm test before committing.', tags: ['commit', 'test'] })
    ]
    const { inj } = injector(fakeStore(entries))
    const append = await inj.buildAppend({ cwd: '/proj', firstText: 'how to commit' })

    expect(append).toContain('<memory>')
    expect(append).toContain('may be stale')
    expect(append).toContain('## Preferences')
    expect(append).toContain('- User prefers concise answers.')
    expect(append).toContain('## Skills')
    expect(append).toContain('- When commit, test: Run npm test before committing.')
    // 无 fact/lesson 条目 → 分区省略
    expect(append).not.toContain('## Facts')
    expect(append).not.toContain('## Lessons')
    expect(append).toContain('</memory>')
  })

  it('AC-5: 选中非空 → memory:recalled 事件（sessionId 命中与 "" 回退）', async () => {
    const entries = [entry({ id: 'e1', content: 'remembered fact', tags: ['x'] })]
    const { inj, sent } = injector(fakeStore(entries))
    await inj.buildAppend({ cwd: '/proj', firstText: 'x question' })

    expect(sent).toHaveLength(1)
    expect(sent[0].channel).toBe('memory:recalled')
    expect(sent[0].payload).toEqual({
      sessionId: 's-live',
      source: 'app',
      memories: [{ id: 'e1', kind: 'fact', content: 'remembered fact' }]
    })

    // sessionId 未捕获 → ''
    const { inj: inj2, sent: sent2 } = injector(fakeStore(entries), () => null)
    await inj2.buildAppend({ cwd: '/proj', firstText: 'x question' })
    expect((sent2[0].payload as { sessionId: string }).sessionId).toBe('')
  })

  it('AC-6: store.list() reject → 返回 "" 不抛', async () => {
    const failing = { list: () => Promise.reject(new Error('disk boom')) } as unknown as MemoryStore
    const { inj, sent } = injector(failing)
    const append = await inj.buildAppend({ cwd: '/proj', firstText: 'hi' })
    expect(append).toBe('')
    expect(sent).toHaveLength(0)
  })
})
