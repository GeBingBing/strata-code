# Design: app-shell

## Context

实现 [requirements.md](./requirements.md) 的通信基座。核心决策：**通道契约集中在 `src/shared/ipc.ts`**，以常量表 + 泛型包装在编译期锁定通道名与载荷类型，主进程（typedHandle）、preload（透传）、渲染进程（api.invoke）三方共享同一类型源（AC-5）。

## Data Flow / Architecture

```
Renderer                          Main
┌──────────────────┐   invoke    ┌─────────────────────┐
│ api.invoke(      ├────────────►│ ipcMain.handle      │
│   'agent:send',  │  (async)    │  typedHandlers.get()│
│   {text})        │◄────────────┤ handler(payload)    │
│                  │  result     └─────────────────────┘
│ api.on(          │   event     ┌─────────────────────┐
│   'agent:message'│◄────────────┤ webContents.send    │
│   cb)            │  one-way    └─────────────────────┘
└──────────────────┘
        ▲ preload: contextBridge.exposeInMainWorld('api', …)
```

## Contracts

```ts
// src/shared/ipc.ts — 单一事实源
export const invokeChannels = { /* name: (payload) => Result */ } as const
export const eventChannels  = { /* name: (payload) => void */ } as const

export type InvokeChannel = keyof typeof invokeChannels
export type EventChannel  = keyof typeof eventChannels

// 主进程注册：typedHandle(win, { 'agent:send': async (p) => … })
// 渲染进程调用：api.invoke('agent:send', { text: 'hi' })
```

- `api.invoke` 返回 `Promise<T>`；未注册通道 → reject（AC-3）；handler 抛异常 → reject Error.message（AC-4）。
- `api.on(channel, cb)` 返回 `() => void` 取消订阅（AC-2）。

## Edge Cases

- 渲染进程在窗口 reload 后重复订阅 → `on` 每次注册独立 listener，off 精确移除。
- handler 返回 undefined → resolve(undefined)，不视为错误。
- IPC 载荷必须是可结构化克隆的 — 契约类型全部为纯数据（不含函数/Class 实例）。

## Alternatives Considered

- **electron-trpc / tRPC over IPC**: 类型安全更自动，但引入运行时依赖与抽象层；MVP 阶段常量表 + 泛型已达成编译期安全，且测试更直接。
- **Electron IPC 原生 + 手写类型**: 无单一事实源，通道名散落各处，正是要消除的错误来源。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/3/4 | `tests/main/ipc.test.ts` | typedHandle 注册、未注册通道 reject、handler 异常回传 |
| AC-2 | `tests/main/ipc.test.ts` | on/off 订阅与取消（经 fake webContents 断言 send 调用） |
| AC-5 | `npm run typecheck` | 类型不匹配 = 编译失败（契约两侧共享类型） |
