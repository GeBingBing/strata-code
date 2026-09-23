import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SearchService } from '../../src/main/search/searchService'

/** spec: sidebar-registry AC-5 —— SearchService */

let dir = ''
let svc: SearchService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'search-'))
  svc = new SearchService()
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {})
});

describe('SearchService', () => {
  it('匹配文件内容并返回 line + preview', async () => {
    await writeFile(join(dir, 'a.ts'), 'hello world\nfoo bar\nhello again')
    await writeFile(join(dir, 'b.ts'), 'nothing here')

    const results = await svc.search(dir, 'hello')

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.path).sort()).toEqual(['a.ts', 'a.ts'])
    expect(results[0].line).toBe(1)
    expect(results[1].line).toBe(3)
    expect(results[0].preview).toContain('hello')
  })

  it('跳过 node_modules 与隐藏目录', async () => {
    await writeFile(join(dir, 'keep.ts'), 'hello')
    await mkdir(join(dir, 'node_modules'))
    await writeFile(join(dir, 'node_modules/dep.ts'), 'hello')
    await writeFile(join(dir, '.secret.ts'), 'hello')

    const results = await svc.search(dir, 'hello')

    expect(results).toHaveLength(1)
    expect(results[0].path).toBe('keep.ts')
  })

  it('跳过二进制文件', async () => {
    await writeFile(join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 0, 104, 105]))
    await writeFile(join(dir, 'a.ts'), 'hello binary')

    const results = await svc.search(dir, 'hello')

    expect(results.map((r) => r.path)).toEqual(['a.ts'])
  })

  it('空 query 返回空', async () => {
    await writeFile(join(dir, 'a.ts'), 'hello')
    const results = await svc.search(dir, '')
    expect(results).toEqual([])
  })
})
