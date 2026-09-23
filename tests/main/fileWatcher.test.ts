import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileWatcher } from '../../src/main/files/fileWatcher'

/** spec: file-watcher AC-2/4 —— 写入触发事件，自写抑制 */

let dir = ''
let watcher: FileWatcher

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fw-'))
  watcher = new FileWatcher({ debounceMs: 30, suppressMs: 200 })
  watcher.watch(dir)
})

afterEach(async () => {
  watcher.dispose()
  await rm(dir, { recursive: true, force: true }).catch(() => {})
});

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('FileWatcher', () => {
  it('写入文件触发 change 事件 (AC-2)', async () => {
    const events: Array<{ path: string; kind: string }> = []
    watcher.on('change', (e) => events.push(e))

    await writeFile(join(dir, 'a.ts'), 'hello')
    await wait(120)

    expect(events).toHaveLength(1)
    expect(events[0].path).toBe(join(dir, 'a.ts'))
    expect(events[0].kind).toBe('change')
  })

  it('自写抑制窗口内的写入不触发事件 (AC-4)', async () => {
    const events: Array<{ path: string; kind: string }> = []
    watcher.on('change', (e) => events.push(e))

    const path = join(dir, 'b.ts')
    // markOwnWrite 使用相对路径，因为 fs.watch callback 接收的 filename 是相对的
    watcher.markOwnWrite('b.ts')
    await writeFile(path, 'x')
    await wait(80)

    expect(events).toHaveLength(0)
  })

  it('跳过 node_modules 与隐藏目录', async () => {
    const events: Array<{ path: string; kind: string }> = []
    watcher.on('change', (e) => events.push(e))

    await mkdir(join(dir, 'node_modules'))
    await writeFile(join(dir, 'node_modules', 'dep.js'), 'x')
    await writeFile(join(dir, '.hidden.ts'), 'x')
    await wait(80)

    // eslint-disable-next-line no-console
    console.log('events:', events)
    expect(events).toHaveLength(0)
  })

  it('dispose 之后不再监听', async () => {
    const events: Array<{ path: string; kind: string }> = []
    watcher.on('change', (e) => events.push(e))
    watcher.dispose()

    await writeFile(join(dir, 'c.ts'), 'x')
    await wait(80)

    expect(events).toHaveLength(0)
  })
})
