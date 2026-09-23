import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startHttpServer } from '../../src/main/httpServer'
import type { InvokeHandlerMap } from '@shared/ipc'

/** spec: vscode-extension transport —— HTTP + SSE 服务 */

describe('startHttpServer', () => {
  it('启动后 GET /health 返回 ok', async () => {
    const handlers: InvokeHandlerMap = {}
    const srv = await startHttpServer(handlers)
    const res = await fetch(`http://127.0.0.1:${srv.port}/health`)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    srv.close()
  })

  it('POST /invoke 调用 handler 并返回结果', async () => {
    const handlers: InvokeHandlerMap = {
      'agent:send': (async ({ text }: { text: string }) => ({ echoed: text })) as never
    }
    const srv = await startHttpServer(handlers)

    const res = await fetch(`http://127.0.0.1:${srv.port}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'agent:send', payload: { text: 'hi' } })
    })
    const json = (await res.json()) as { result: { echoed: string } }
    expect(json.result.echoed).toBe('hi')
    srv.close()
  })

  it('未知 channel 返回 404', async () => {
    const srv = await startHttpServer({})
    const res = await fetch(`http://127.0.0.1:${srv.port}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'unknown:channel', payload: {} })
    })
    expect(res.status).toBe(404)
    srv.close()
  })

  /** spec: runtime-port-discovery —— 实际端口写入用户指定路径 */
  it('绑定后原子写 agent-port.json；close 删除文件', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'port-'))
    try {
      const portFile = join(dir, 'agent-port.json')
      const srv = await startHttpServer({}, 17361, portFile)
      const raw = await readFile(portFile, 'utf-8')
      const parsed = JSON.parse(raw) as { port: number; pid: number; updatedAt: number }
      expect(parsed.port).toBe(srv.port)
      expect(parsed.pid).toBe(process.pid)

      await srv.close()
      await expect(readFile(portFile, 'utf-8')).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })
})