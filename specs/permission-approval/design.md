# Design: permission-approval

## Context

实现 [requirements.md](./requirements.md)。**测试先行**：4 个防悬挂红测试在任何实现之前写好 — 这是全应用最容易产生静默死锁的地方。

## Data Flow / Architecture

```
SDK canUseTool(tool, input, {signal, suggestions})
        │
        ▼ id=uuid, pending.set(id, {resolve, signalCleanup})
Main: webContents.send('permission:request', {id, toolName, input, …})
        │                                    ▲
        │ renderer 显示 PermissionDialog      │
        ▼                                    │
Renderer: api.invoke('permission:respond', {id, decision}) ──┘
        │
        ▼ main: pending.get(id) → resolve(decision), pending.delete(id)

悬挂防线：
  signal.addEventListener('abort', → deny 这一个)
  webContents.once('destroyed', → deny 全部)
  respond(id 未知/已解决) → 忽略
```

## Contracts

```ts
// event
'permission:request': { id: string; toolName: string; input: Record<string, unknown>;
                        suggestions?: PermissionUpdate[]; blockedPath?: string; decisionReason?: string }
// invoke
'permission:respond': (p: { id: string; decision: { behavior: 'allow' | 'deny';
  updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[] } }) => Promise<void>

// PermissionBridge
class PermissionBridge {
  handler: CanUseTool            // 注入 AgentService options.canUseTool
  respond(id, decision): void    // IPC handler 调用；幂等
  denyAll(reason?): void         // dispose 时调用
}
```

## Edge Cases

- 同一 signal 多次 abort → cleanup 监听器只触发一次 deny。
- 窗口 reload（非销毁）→ MVP 接受请求丢失后靠 respond 幂等 + 用户重发；dialog 渲染端按 pending state 重建。
- respond 在请求已 deny（abort）后到达 → 幂等忽略（AC-5）。

## Alternatives Considered

- **超时自动拒绝**: 简单但破坏长时阅读 diff 的用户体验 — MVP 不做，agent 等待是安全的（文档化）。
- **全部走 PreToolUse hook**: hook 无法交互式询问用户，只能 allow/deny — 不满足需求。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `tests/main/agent/PermissionBridge.test.ts` | 请求带唯一 id 发出；respond 后 Promise 以 decision 解决 |
| AC-3 | 同上 | abort signal → 该请求 deny 且 Promise 不悬挂 |
| AC-4 | 同上 | webContents destroyed → 全部 pending deny |
| AC-5 | 同上 | 未知 id respond 不抛异常；重复 respond 幂等 |
| AC-6 | 同上 | always-allow decision 透传 updatedPermissions |
| AC-7 | `src/renderer/src/components/permissions/PermissionDialog.test.tsx` | 渲染工具名/参数/三按钮；点击调用 respond |
