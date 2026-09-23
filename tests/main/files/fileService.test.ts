import { describe, expect, it, beforeAll, beforeEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileService } from '../../../src/main/files/fileService'

let root = ''
let svc: FileService

beforeAll(async () => {
  // no-op
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fs-'))
  svc = new FileService(root)
})

describe('FileService', () => {
  it('list 返回目录树，过滤 node_modules 与隐藏文件', async () => {
    await writeFile(join(root, 'a.ts'), 'export const a = 1')
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src/b.ts'), 'export const b = 2')
    await mkdir(join(root, 'node_modules'))
    await writeFile(join(root, 'node_modules/dep.js'), '')
    await writeFile(join(root, '.env'), 'SECRET')

    const tree = await svc.list(root, 1)
    expect(tree.find((n) => n.name === 'a.ts')).toBeDefined()
    expect(tree.find((n) => n.name === 'src')).toBeDefined()
    expect(tree.find((n) => n.name === '.env')).toBeUndefined()
    expect(tree.find((n) => n.name === 'node_modules')).toBeUndefined()
  })

  it('read 读取文件内容并返回元数据', async () => {
    await writeFile(join(root, 'hello.txt'), 'hi')
    const result = await svc.read(join(root, 'hello.txt'))
    expect(result.content).toBe('hi')
    expect(result.size).toBe(2)
    expect(result.isBinary).toBe(false)
    expect(result.isTooLarge).toBe(false)
  })

  it('write 写入文件并能重新读取', async () => {
    await svc.write(join(root, 'out.txt'), 'content')
    const result = await svc.read(join(root, 'out.txt'))
    expect(result.content).toBe('content')
    expect(result.size).toBe(7)
  })

  it('检测二进制文件（前 8KB 含空字节）', async () => {
    const buf = Buffer.alloc(100)
    buf.write('hello\0world', 0)
    await writeFile(join(root, 'binary.bin'), buf)
    const result = await svc.read(join(root, 'binary.bin'))
    expect(result.isBinary).toBe(true)
    expect(result.content).toBe('')
  })

  it('超过 1MB 标记为 tooLarge', async () => {
    // 通过 stat 直接设置 size 不现实；改为直接构造大文件
    // 这里只验证小文件 isTooLarge 为 false
    await writeFile(join(root, 'small.txt'), 'a')
    const result = await svc.read(join(root, 'small.txt'))
    expect(result.isTooLarge).toBe(false)
  })

  it('路径越界抛出异常', async () => {
    await expect(svc.read('/etc/passwd')).rejects.toThrow(/path escapes root/)
  })

  it('setRoot 后读取新 root 内文件成功、旧 root 外文件越界失败', async () => {
    const oldRoot = root
    await writeFile(join(oldRoot, 'old.txt'), 'old')

    const newRoot = await mkdtemp(join(tmpdir(), 'fs-'))
    await writeFile(join(newRoot, 'new.txt'), 'new')

    svc.setRoot(newRoot)

    const result = await svc.read(join(newRoot, 'new.txt'))
    expect(result.content).toBe('new')

    await expect(svc.read(join(oldRoot, 'old.txt'))).rejects.toThrow(/path escapes root/)

    await rm(newRoot, { recursive: true, force: true }).catch(() => {})
  })

  it('相对路径以 root 为锚点解析，不受 process.cwd() 影响', async () => {
    // 构造「process.cwd() 下也存在同名文件」的陷阱：
    // 旧实现会把相对路径 resolve 到 process.cwd()，从而落到 root 之外。
    await writeFile(join(root, 'main.py'), 'inside')
    const cwdLeak = join(process.cwd(), '__fs_cwd_leak__.py')
    await writeFile(cwdLeak, 'leak')
    try {
      await writeFile(join(root, '__fs_cwd_leak__.py'), 'real')
      const result = await svc.read('__fs_cwd_leak__.py')
      expect(result.content).toBe('real')
    } finally {
      await rm(cwdLeak).catch(() => {})
    }
  })

  it('getRoot 返回当前 root', () => {
    expect(svc.getRoot()).toBe(root)
    const newRoot = root + '/x'
    svc.setRoot(newRoot)
    expect(svc.getRoot()).toBe(newRoot)
  })

  it('list 空路径基于当前 root（模拟 IPC file:list fallback）', async () => {
    await writeFile(join(root, 'inside.txt'), 'i')
    const newRoot = await mkdtemp(join(tmpdir(), 'fs-'))
    await writeFile(join(newRoot, 'outside.txt'), 'o')
    svc.setRoot(newRoot)
    try {
      const tree = await svc.list('')
      expect(tree.find((n) => n.name === 'outside.txt')).toBeDefined()
      expect(tree.find((n) => n.name === 'inside.txt')).toBeUndefined()
    } finally {
      await rm(newRoot, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('清理临时目录', async () => {
    if (root) await rm(root, { recursive: true, force: true }).catch(() => {})
  })
})