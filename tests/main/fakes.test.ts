import { describe, expect, it } from 'vitest'
import { createFakeWin, createFakeIpcMain } from './fakes'
import type { WebContentsLike } from '../../src/main/ipc-interfaces'

/** spec: test-infrastructure (AC-1/2) —— 主进程 fake 工厂的契约 */

describe('createFakeWin', () => {
  it('AC-1: 返回一个 WebContentsLike，send 把事件记录到 sent[]', () => {
    const { win, sent } = createFakeWin()
    win.send('agent:message', { seq: 1 })
    expect(sent).toEqual([{ channel: 'agent:message', payload: { seq: 1 } }])
  })

  it('AC-1: 多次 send 按调用顺序追加', () => {
    const { win, sent } = createFakeWin()
    win.send('a', 1)
    win.send('b', 2)
    win.send('a', 3)
    expect(sent.map((s) => s.channel)).toEqual(['a', 'b', 'a'])
    expect(sent.map((s) => s.payload)).toEqual([1, 2, 3])
  })

  it('AC-1: once 注册监听器，destroy() 触发 destroyed 监听器', () => {
    const { win, destroy, listeners } = createFakeWin()
    const fn = () => {}
    win.once('destroyed', fn)
    expect(listeners.get('destroyed')).toBe(fn)
    destroy()
    expect(win.isDestroyed()).toBe(true)
  })

  it('AC-1: 默认未销毁，destroy() 之后 isDestroyed() 返回 true', () => {
    const { win, destroy } = createFakeWin()
    expect(win.isDestroyed()).toBe(false)
    destroy()
    expect(win.isDestroyed()).toBe(true)
  })

  it('AC-1: 同一事件多次 once —— 后者覆盖前者（与现有内联实现一致）', () => {
    const { win, listeners } = createFakeWin()
    const a = () => {}
    const b = () => {}
    win.once('destroyed', a)
    win.once('destroyed', b)
    expect(listeners.get('destroyed')).toBe(b)
  })

  it('AC-1: 返回的 win 实现 WebContentsLike 接口', () => {
    const { win } = createFakeWin()
    const typed: WebContentsLike = win
    expect(typeof typed.send).toBe('function')
    expect(typeof typed.once).toBe('function')
    expect(typeof typed.isDestroyed).toBe('function')
  })
})

describe('createFakeIpcMain', () => {
  it('AC-2: handle 注册 handler，invokeChannel 能调到对应 handler 并拿到返回值', () => {
    const ipc = createFakeIpcMain()
    ipc.handle('config:get', () => ({ ok: true }))
    expect(ipc.invoke('config:get')).toEqual({ ok: true })
  })

  it('AC-2: handler 未注册时 invoke 抛错，便于测试断言', () => {
    const ipc = createFakeIpcMain()
    expect(() => ipc.invoke('nope')).toThrow(/nope/)
  })

  it('AC-2: invoke 透传 event 对象与 args 列表', () => {
    const ipc = createFakeIpcMain()
    ipc.handle('echo', (_evt, ...args) => args)
    expect(ipc.invoke('echo', 1, 'x', true)).toEqual([1, 'x', true])
  })

  it('AC-2: handlers 列表可被测试断言注册情况', () => {
    const ipc = createFakeIpcMain()
    ipc.handle('a', () => null)
    ipc.handle('b', () => null)
    expect(ipc.handlers.has('a')).toBe(true)
    expect(ipc.handlers.has('b')).toBe(true)
    expect(ipc.handlers.has('c')).toBe(false)
  })
})