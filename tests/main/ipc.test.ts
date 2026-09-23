import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import { handleInvoke, sendEvent } from '../../src/main/ipc'
import type { IpcMainLike, WebContentsLike } from '../../src/main/ipc-interfaces'

/** spec: app-shell AC-1~4 —— typedHandle 注册与调用语义（借助 ipcMain 形状的 fake） */

class FakeIpcMain extends EventEmitter implements IpcMainLike {
  handlers = new Map<string, (event: unknown, payload: never) => unknown>()
  handle(channel: string, listener: (event: unknown, payload: never) => unknown): void {
    this.handlers.set(channel, listener)
  }
}

/** 模拟渲染进程 invoke：未注册通道 → reject（AC-3）；handler 异常 → reject（AC-4） */
async function invokeFromRenderer<T>(ipcMain: FakeIpcMain, channel: string, payload: T): Promise<unknown> {
  const handler = ipcMain.handlers.get(channel)
  if (!handler) {
    throw new Error(`No handler registered for '${channel}'`)
  }
  return handler({}, payload as never)
}

describe('ipc typedHandle', () => {
  it('AC-1: 注册的 handler 收到载荷并返回结果', async () => {
    const ipcMain = new FakeIpcMain()
    handleInvoke(ipcMain, 'sessions:list', async () => [{ id: 's1', title: 't', cwd: '/', createdAt: 1, updatedAt: 1 }])

    const result = (await invokeFromRenderer(ipcMain, 'sessions:list', undefined)) as Array<{ id: string }>
    expect(result[0].id).toBe('s1')
  })

  it('AC-3: 未注册通道 → reject（携带通道名）', async () => {
    const ipcMain = new FakeIpcMain()
    await expect(invokeFromRenderer(ipcMain, 'nope:channel', undefined)).rejects.toThrow(
      /nope:channel/
    )
  })

  it('AC-4: handler 抛异常 → 错误传回调用方', async () => {
    const ipcMain = new FakeIpcMain()
    handleInvoke(ipcMain, 'agent:send', async () => {
      throw new Error('handler exploded')
    })
    await expect(invokeFromRenderer(ipcMain, 'agent:send', { text: 'x' })).rejects.toThrow(
      'handler exploded'
    )
  })

  it('AC-2: sendEvent 向 webContents 发送事件；销毁后跳过', () => {
    const sent: Array<{ channel: string; payload: unknown }> = []
    const win: WebContentsLike = {
      send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
      once: () => {},
      isDestroyed: () => false
    }
    sendEvent(win, 'agent:status', { sessionId: 's', status: 'idle' })
    expect(sent[0].channel).toBe('agent:status')
    expect(sent[0].payload).toEqual({ sessionId: 's', status: 'idle' })

    const destroyed: WebContentsLike = { ...win, isDestroyed: () => true }
    sendEvent(destroyed, 'agent:status', { sessionId: 's', status: 'idle' })
    expect(sent).toHaveLength(1)
  })
})
