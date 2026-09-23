# Design: test-infrastructure

## Context

实现 [requirements.md](./requirements.md)。本 spec 把散落在各测试文件中的工厂函数与约定集中文档化，作为所有功能 spec 的测试底座。

## Data Flow / Architecture

```
主进程测试:
  createFakeWebContents() → 注入 AgentService / PermissionBridge
  createFakeIpcMain()     → handleInvoke 注册与调用断言

渲染层测试:
  setIpcOverride({ invoke, subscribe }) → api client 使用 fake 实现

E2E:
  Playwright _electron.launch({ env: { APP_AGENT_MODE: 'fake' } })
```

## Contracts

```ts
// 主进程 fake 工厂（各测试文件内联定义，可集中迁移到 tests/main/fakes.ts）
function createFakeWebContents(): WebContentsLike & { sent: ... }
function createFakeIpcMain(): IpcMainLike & { handlers: ... }

// 渲染层 fake IPC
export function setIpcOverride(
  overrides: Partial<{
    invoke: RendererApi['invoke']
    subscribe: (...args) => () => void
  }>
): void

// data-testid 前缀约定
'message-*'     // 消息气泡（user / assistant / error）
'tool-card-*'   // 工具调用卡片（running / success / error）
'permission-*'  // 权限对话框与按钮
'diff-*'        // diff 预览
```

## Edge Cases

- `createFakeWebContents` 的 `once('destroyed', ...)` 需要手动触发以测试 denyAll 路径。
- `setIpcOverride` 在多次调用时应合并而非完全替换，避免测试间状态泄漏。
- E2E 中 fake 模式与真实模式的窗口标题/行为应一致，避免测试分支化。

## Alternatives Considered

- **每份测试文件独立定义 fake 工厂**：当前现状，但重复代码多；本 spec 推动集中化。
- **用 Electron 真实窗口跑单测**：太重，违背单元测试快速反馈原则。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `tests/main/ipc.test.ts` 及各主进程测试 | fake WebContents / IpcMain 工厂被使用并通过断言 |
| AC-3 | `tests/renderer/src/...` | 组件测试使用 setIpcOverride |
| AC-4/5 | 所有 E2E 与组件测试 | grep 验证 data-testid 前缀合规 |
| AC-6 | `tests/e2e/helpers.ts` | launchApp 强制 APP_AGENT_MODE=fake |
