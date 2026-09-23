import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryStore } from '../../../src/main/memory/MemoryStore'
import type { MemoryEntry } from '@shared/types'

/** spec: memory-core AC-1/2/3/8 */

const dirs: string[] = []
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

async function tempStore(): Promise<{ store: MemoryStore; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'memory-test-'))
  dirs.push(dir)
  const file = join(dir, 'memory.json')
  return { store: new MemoryStore(file), file }
}

export function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 'fact-1000-aaaa',
    kind: 'fact',
    scope: 'global',
    cwd: null,
    content: 'User works on an Electron app.',
    confidence: 0.6,
    hits: 0,
    tags: ['electron'],
    sourceSessionId: 's-1',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

describe('MemoryStore', () => {
  it('AC-1: 缺失文件 → 空库；损坏 JSON → 空库不抛', async () => {
    const { store, file } = await tempStore()
    expect(await store.list()).toEqual([])

    await writeFile(file, '{not valid json!!', 'utf-8')
    const store2 = new MemoryStore(file)
    expect(await store2.list()).toEqual([])
  })

  it('AC-2: upsert 已存在 id → 更新且保留 createdAt', async () => {
    const { store } = await tempStore()
    await store.upsert(makeEntry({ id: 'a', createdAt: 111, updatedAt: 111 }))
    await store.upsert(makeEntry({ id: 'a', content: 'updated', updatedAt: 5000 }))

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0].content).toBe('updated')
    expect(list[0].createdAt).toBe(111)
    expect(list[0].updatedAt).toBe(5000)
  })

  it('AC-3: 并发 upsert 不丢更新（写互斥）', async () => {
    const { store, file } = await tempStore()
    await Promise.all([
      store.upsert(makeEntry({ id: 'a', content: 'first' })),
      store.upsert(makeEntry({ id: 'b', content: 'second' })),
      store.upsert(makeEntry({ id: 'a', content: 'third' })),
      store.delete('b')
    ])

    // 重新加载验证持久化结果
    const store2 = new MemoryStore(file)
    const list = await store2.list()
    expect(list.map((e) => e.id)).toEqual(['a'])
  })

  it('AC-8: replace 批量原子替换（重新加载内容一致）', async () => {
    const { store, file } = await tempStore()
    await store.upsert(makeEntry({ id: 'old' }))
    await store.replace([makeEntry({ id: 'x' }), makeEntry({ id: 'y' })])

    const store2 = new MemoryStore(file)
    const list = await store2.list()
    expect(list.map((e) => e.id).sort()).toEqual(['x', 'y'])

    const raw = JSON.parse(await readFile(file, 'utf-8'))
    expect(raw.version).toBe(1)
  })

  it('delete 未知 id 静默无操作', async () => {
    const { store } = await tempStore()
    await store.upsert(makeEntry({ id: 'a' }))
    await store.delete('nope')
    expect(await store.list()).toHaveLength(1)
  })
})
