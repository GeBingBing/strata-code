import type { EventChannel, EventPayload, InvokeChannel, InvokeHandler, InvokePayload } from '@shared/ipc'
import type { EventChannelMap, IpcMainLike, WebContentsLike } from './ipc-interfaces'

export type { EventChannelMap, IpcMainLike, WebContentsLike }

/**
 * 类型安全的 invoke handler 注册。
 * AC-3/AC-4 的保障由 ipcMain.handle 原生语义提供：
 * - 未注册通道 → invoke 侧 reject（Electron 行为）
 * - handler 抛异常 → 错误消息传回 invoke 侧的 Promise.reject
 */
export function handleInvoke<C extends InvokeChannel>(
  ipcMain: IpcMainLike,
  channel: C,
  handler: InvokeHandler<C>
): void {
  ipcMain.handle(channel, (_event: unknown, ...args: unknown[]) =>
    handler(args[0] as InvokePayload<C>)
  )
}

/**
 * 类型安全的事件发送（主进程 → 渲染进程）。
 */
export function sendEvent<C extends EventChannel>(
  win: WebContentsLike,
  channel: C,
  payload: EventPayload<C>
): void {
  if (win.isDestroyed()) return
  win.send(channel, payload)
}
