import type { EventChannel, EventPayload } from '@shared/ipc'

/**
 * Electron 依赖的最小接口 —— 单测注入 fake 实现，无需启动 Electron。
 */
export interface WebContentsLike {
  send(channel: string, ...args: unknown[]): void
  once(event: string, listener: () => void): void
  isDestroyed(): boolean
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
}

/** 事件发送器集合 —— AgentService 等主进程服务持有它向渲染进程广播 */
export interface EventChannelMap {
  send<C extends EventChannel>(channel: C, payload: EventPayload<C>): void
}
