import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitService } from '../../src/main/git/gitService'

/** spec: sidebar-registry AC-6 —— GitService */

let dir = ''
let svc: GitService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'git-'))
  svc = new GitService()
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true }).catch(() => {})
});

describe('GitService', () => {
  it('非 git 目录返回空 status 不抛错', async () => {
    const status = await svc.status(dir)
    expect(status.branch).toBe('')
    expect(status.files).toEqual([])
  })

  it('git 仓库能解析 branch 与文件状态', async () => {
    // 初始化一个最小 git 仓库
    await run(['init', '-q'])
    await run(['config', 'user.email', 'test@test.com'])
    await run(['config', 'user.name', 'Test'])
    await writeFile(join(dir, 'a.txt'), 'hello')
    await run(['add', 'a.txt'])
    await run(['commit', '-q', '-m', 'initial'])

    const status = await svc.status(dir)
    expect(status.branch.length).toBeGreaterThan(0)
  })

  it('git log 解析 commit 字段', async () => {
    await run(['init', '-q'])
    await run(['config', 'user.email', 'test@test.com'])
    await run(['config', 'user.name', 'Test'])
    await writeFile(join(dir, 'a.txt'), 'hi')
    await run(['add', 'a.txt'])
    await run(['commit', '-q', '-m', 'first commit'])

    const log = await svc.log(dir, 5)
    expect(log.length).toBe(1)
    expect(log[0].message).toBe('first commit')
    expect(log[0].sha.length).toBeGreaterThan(0)
    expect(log[0].date).toBeGreaterThan(0)
  })

  it('git diff 在无变更时返回空字符串', async () => {
    await run(['init', '-q'])
    await run(['config', 'user.email', 'test@test.com'])
    await run(['config', 'user.name', 'Test'])
    await writeFile(join(dir, 'a.txt'), 'hi')
    await run(['add', 'a.txt'])
    await run(['commit', '-q', '-m', 'initial'])

    const diff = await svc.diff(dir)
    expect(diff).toBe('')
  })

  async function run(args: string[]): Promise<void> {
    const { spawn } = await import('node:child_process')
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', args, { cwd: dir })
      p.on('error', reject)
      p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`git ${args.join(' ')} failed`))))
    })
  }
})
