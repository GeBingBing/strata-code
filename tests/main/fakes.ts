import type { IpcMainLike, WebContentsLike } from '../../src/main/ipc-interfaces'

/**
 * spec: test-infrastructure (AC-1)
 * 主进程 fake WebContents —— 用于把 AgentService / PermissionBridge 等模块
 * 注入到测试中，无需启动真实 Electron。`destroy()` 触发已注册的 destroyed 监听器，
 * 便于覆盖 deny-on-window-destroyed 路径。
 */
export interface FakeWin {
  win: WebContentsLike
  sent: Array<{ channel: string; payload: unknown }>
  listeners: Map<string, () => void>
  destroy: () => void
}

export function createFakeWin(): FakeWin {
  const sent: Array<{ channel: string; payload: unknown }> = []
  const listeners = new Map<string, () => void>()
  let destroyed = false
  const win: WebContentsLike = {
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload })
    },
    once: (event: string, listener: () => void) => {
      listeners.set(event, listener)
    },
    isDestroyed: () => destroyed
  }
  return {
    win,
    sent,
    listeners,
    destroy: () => {
      destroyed = true
      listeners.get('destroyed')?.()
    }
  }
}

/**
 * spec: test-infrastructure (AC-2)
 * 主进程 fake IpcMain —— 注册 handler 并允许测试直接 invoke。
 * 未注册的 channel 抛错，便于遗漏注册时立即失败。
 */
export interface FakeIpcMain extends IpcMainLike {
  handlers: Map<string, (event: unknown, ...args: unknown[]) => unknown>
  invoke: (channel: string, ...args: unknown[]) => unknown
}

export function createFakeIpcMain(): FakeIpcMain {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  return {
    handlers,
    handle: (channel, listener) => {
      handlers.set(channel, listener)
    },
    invoke: (channel, ...args) => {
      const handler = handlers.get(channel)
      if (!handler) {
        throw new Error(`No IPC handler registered for channel "${channel}"`)
      }
      return handler(undefined, ...args)
    }
  }
}