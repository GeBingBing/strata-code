# Requirements: app-shell

## Overview

应用外壳：Electron 窗口、类型化 IPC 契约、preload 安全桥。它是所有后续功能（agent-service、chat-ui、permission-approval 等）的通信基座 — 定义渲染进程与主进程之间唯一的、编译期类型安全的消息协议。

## Stakeholders

- **用户**: 无直接感知，但依赖它获得响应快速的窗口与安全的应用（contextIsolation 开启）。
- **开发者**: 所有功能的实现者依赖 `src/shared/ipc.ts` 作为单一事实源；拼错通道名或传错载荷必须是编译错误，而不是运行时静默失败。

## Assumptions

- Electron ≥ 28（主进程原生 ESM）；preload 保持 CJS（sandboxed preload 不支持 ESM）。
- 渲染进程启用 `contextIsolation: true`、`nodeIntegration: false`，仅通过 `contextBridge` 暴露的 `window.api` 通信。

## Acceptance Criteria (EARS)

- AC-1: WHEN 渲染进程通过 `window.api.invoke(channel, payload)` 调用任一注册的 invoke 通道, THE SYSTEM SHALL 在主进程以类型校验过的载荷执行对应 handler 并返回其结果。
- AC-2: WHEN 渲染进程订阅任一 event 通道, THE SYSTEM SHALL 在主进程发送该事件时收到回调，且返回的取消订阅函数能移除监听。
- AC-3: IF 渲染进程 invoke 一个未注册的通道, THE SYSTEM SHALL 返回拒绝的 Promise（携带通道名），而非静默失败。
- AC-4: IF 主进程 handler 抛出异常, THE SYSTEM SHALL 将错误消息经 invoke 的 Promise 拒绝传回渲染进程。
- AC-5: WHEN 通道名或载荷类型不匹配契约定义, THE SYSTEM SHALL 在编译期（TypeScript）报错 — 即契约代码两侧共享同一类型源。

## Out of Scope

- 任何业务功能（agent、聊天、权限）— 仅通信基座。
- 窗口外观定制（在脚手架默认之上仅做最小必要调整）。
