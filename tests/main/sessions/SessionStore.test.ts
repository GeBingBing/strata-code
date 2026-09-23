import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore, titleFromFirstMessage } from '../../../src/main/sessions/SessionStore'
import type { SessionSummary } from '@shared/types'

/** spec: session-history AC-1~7 */

const dirs: string[] = []
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

async function tempStore(): Promise<{ store: SessionStore; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'sessions-test-'))
  dirs.push(dir)
  const file = join(dir, 'sessions.json')
  return { store: new SessionStore(file), file }
}

const entry = (id: string, updatedAt: number) => ({
  id,
  title: `session ${id}`,
  cwd: '/tmp',
  createdAt: updatedAt - 1000,
  updatedAt
})

describe('SessionStore', () => {
  it('AC-1/3: upsert 创建条目；list 按 updatedAt 降序', async () => {
    const { store } = await tempStore()
    await store.upsert(entry('a', 1000))
    await store.upsert(entry('b', 3000))
    await store.upsert(entry('c', 2000))

    const list = await store.list()
    expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('AC-2: upsert 已有条目更新 updatedAt 并保留 createdAt', async () => {
    const { store } = await tempStore()
    await store.upsert({ ...entry('a', 1000), createdAt: 111 })
    await store.upsert(entry('a', 5000))

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0].updatedAt).toBe(5000)
    expect(list[0].createdAt).toBe(111)
  })

  it('AC-5: rename 更新标题；delete 移除条目', async () => {
    const { store } = await tempStore()
    await store.upsert(entry('a', 1000))

    await store.rename('a', 'renamed')
    expect((await store.list())[0].title).toBe('renamed')

    await store.delete('a')
    expect(await store.list()).toEqual([])
  })

  it('AC-6: 损坏 JSON → 空列表不抛', async () => {
    const { store, file } = await tempStore()
    await writeFile(file, '{not valid json!!', 'utf-8')

    const list = await store.list()
    expect(list).toEqual([])

    // 损坏后仍可正常写入
    await store.upsert(entry('x', 1))
    expect((await store.list()).map((s) => s.id)).toEqual(['x'])
  })

  it('AC-7: 原子写 —— 文件为合法 JSON 且无残留 tmp', async () => {
    const { store, file } = await tempStore()
    await store.upsert(entry('a', 1000))

    const raw = await readFile(file, 'utf-8')
    expect(JSON.parse(raw).sessions).toHaveLength(1)
    // tmp 文件已被 rename 消费（或从未持久存在于同一路径）
    await expect(readFile(`${file}.tmp`, 'utf-8')).rejects.toThrow()
  })

  it('titleFromFirstMessage: 首行截断 80 字符', () => {
    expect(titleFromFirstMessage('a'.repeat(100))).toHaveLength(81) // 80 + …
    expect(titleFromFirstMessage('short')).toBe('short')
    expect(titleFromFirstMessage('line1\nline2')).toBe('line1')
    expect(titleFromFirstMessage('')).toBe('New session')
  })

  /** spec: store-robustness —— 并发 upsert + delete 不丢更新，最终文件内容自洽 */
  it('并发 upsert/upsert/upsert + rename + delete 串行化', async () => {
    const { store, file } = await tempStore()

    await Promise.all([
      store.upsert(entry('a', 1)),
      store.upsert(entry('b', 1)),
      store.upsert(entry('c', 1)),
      store.rename('a', 'A2'),
      store.delete('b')
    ])

    const list = await store.list()
    const ids = list.map((s) => s.id).sort()
    // b 被删除；a 重命名后仍存在；c 新增
    expect(ids).toEqual(['a', 'c'])
    expect(list.find((s) => s.id === 'a')?.title).toBe('A2')

    const raw = await readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as { sessions: SessionSummary[] }
    expect(parsed.sessions.map((s) => s.id).sort()).toEqual(['a', 'c'])
  })
})
