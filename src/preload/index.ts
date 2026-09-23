import { contextBridge, ipcRenderer } from 'electron'
import type { RendererApi } from '@shared/ipc'

/**
 * 类型安全的 preload 桥。渲染进程仅见到 window.api 的 invoke/on，
 * 不直接触碰 ipcRenderer 或任何 Node API。
 */
const api: RendererApi = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, args[0]),
  on: (channel, cb) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
      cb(args[0] as never)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
