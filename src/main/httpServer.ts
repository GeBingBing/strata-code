import { promises as fsp } from 'node:fs'
import { dirname } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import type { InvokeChannel, InvokeHandlerMap } from '@shared/ipc'

/**
 * 嵌入式 HTTP + SSE 服务：把现有 invoke/event IPC 暴露给外部客户端
 * （例如 VSCode 扩展侧栏 webview）。完全复用现有 handler，
 * 事件通过 broadcastEvent 主动推送。
 * spec: runtime-port-discovery —— 实际绑定端口原子写入 userData/agent-port.json，
 * 供 VSCode 扩展启动时发现（替代默认 17361 硬编码）。
 */

interface SseClient {
  res: ServerResponse
}

const sseClients = new Set<SseClient>()

export function broadcastEvent(channel: string, payload: unknown): void {
  const data = `event: ${channel}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of sseClients) {
    try {
      client.res.write(data)
    } catch {
      sseClients.delete(client)
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

/**
 * 启动 HTTP 服务，把 invoke handlers 暴露为 POST /invoke，
 * 事件通过 GET /events (SSE) 推送。返回端口与关闭函数。
 */
export async function startHttpServer(
  handlers: InvokeHandlerMap,
  preferredPort = 17361,
  portFilePath?: string
): Promise<{ port: number; close: () => void }> {
  let resolvedPort: number | null = null

  const server = createServer(async (req, res) => {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.url === '/events' && req.method === 'GET') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()
      const client: SseClient = { res }
      sseClients.add(client)
      const ka = setInterval(() => {
        try {
          res.write(': ka\n\n')
        } catch {
          clearInterval(ka)
          sseClients.delete(client)
        }
      }, 25_000)
      req.on('close', () => {
        clearInterval(ka)
        sseClients.delete(client)
      })
      res.write(': ok\n\n')
      return
    }

    if (req.url === '/invoke' && req.method === 'POST') {
      try {
        const body = await readBody(req)
        const { channel, payload } = JSON.parse(body) as { channel: InvokeChannel; payload: unknown }
        const handler = handlers[channel]
        if (!handler) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `unknown channel: ${channel}` }))
          return
        }
        const result = await handler(payload as never)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ result }))
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
      }
      return
    }

    if (req.url === '/health' && req.method === 'GET') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, clients: sseClients.size, port: resolvedPort }))
      return
    }

    res.statusCode = 404
    res.end()
  })

  // spec: runtime-port-discovery —— EADDRINUSE 仅在未监听时降级到 0；持久 error 监听防多次 resolve
  await new Promise<void>((resolve) => {
    let settled = false
    const onError = (err: NodeJS.ErrnoException): void => {
      if (settled) return
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        // 端口被占用：尝试 ephemeral
        settled = true
        server.removeListener('listening', onListening)
        server.listen(0, '127.0.0.1', () => resolve())
        return
      }
      // 其他错误：日志后仍 resolve 以避免阻塞启动；调用方通过 /health 检测
      // eslint-disable-next-line no-console
      console.warn('[http-server] listen error:', err.message)
      settled = true
      server.removeListener('listening', onListening)
      resolve()
    }
    const onListening = (): void => {
      if (settled) return
      settled = true
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(preferredPort, '127.0.0.1')
  })

  const address = server.address()
  resolvedPort = typeof address === 'object' && address ? address.port : preferredPort
  // eslint-disable-next-line no-console
  console.log(`[agent-runtime] HTTP server listening on http://127.0.0.1:${resolvedPort}`)

  // 端口发现：原子写入 userData/agent-port.json（spec: runtime-port-discovery）
  if (portFilePath && resolvedPort !== null) {
    await writePortFile(portFilePath, { port: resolvedPort, pid: process.pid, updatedAt: Date.now() }).catch(
      (err: Error) => {
        // eslint-disable-next-line no-console
        console.warn('[http-server] port file write failed:', err.message)
      }
    )
  }

  return {
    port: resolvedPort ?? preferredPort,
    close: async () => {
      for (const client of sseClients) {
        try {
          client.res.end()
        } catch {
          // ignore
        }
      }
      sseClients.clear()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      if (portFilePath) {
        await fsp.unlink(portFilePath).catch(() => {
          // 文件可能已被外部清理，忽略
        })
      }
    }
  }
}

async function writePortFile(path: string, payload: { port: number; pid: number; updatedAt: number }): Promise<void> {
  await fsp.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8')
  await fsp.rename(tmp, path)
}