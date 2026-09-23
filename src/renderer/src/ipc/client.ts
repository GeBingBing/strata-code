import type {
  EventChannel,
  EventPayload,
  InvokeChannel,
  InvokePayload,
  InvokeResult,
  RendererApi
} from '@shared/ipc'

/**
 * 渲染进程 IPC 客户端 —— window.api（preload 暴露）的类型化包装。
 * 测试通过 mockIpc() 注入替身（见 tests）。
 */
let override: RendererApi | null = null

export function setIpcOverride(api: RendererApi | null): void {
  override = api
}

function api(): RendererApi {
  if (override) return override
  const win = (globalThis as { window?: { api?: RendererApi } }).window
  if (!win?.api) throw new Error('window.api 不可用 —— preload 未加载？')
  return win.api
}

export function invoke<C extends InvokeChannel>(
  channel: C,
  ...payload: InvokePayload<C> extends undefined ? [] : [payload: InvokePayload<C>]
): InvokeResult<C> {
  return api().invoke(channel, ...(payload as never)) as InvokeResult<C>
}

export function subscribe<C extends EventChannel>(
  channel: C,
  cb: (payload: EventPayload<C>) => void
): () => void {
  return api().on(channel, cb)
}
