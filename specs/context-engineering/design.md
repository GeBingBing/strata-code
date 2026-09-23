# Design: context-engineering

## Context

[requirements.md](./requirements.md) — AgentService 是全库唯一构造 SDK `Options` 的地方（`start()`）。本 spec 把它升级为 harness 的上下文组装者：所有接缝记忆无关，memory-injection / memory-distillation 作为插件接上。

## Data Flow

```
send(text) ─→ start()（async）
               ├─ 同步: queue = new PromptQueue(); queue.push(text)   ← 重入守卫的前提
               ├─ await buildSystemPromptAppend({cwd, firstText})
               ├─ Options { cwd, resume, settingSources, systemPrompt?, … }
               ├─ queryFactory({prompt: queue, options})
               └─ void consume()
                      └─ result 消息 → emitStatus(idle, {usage, numTurns})
                                    → onRunComplete({sessionId, numTurns, costUsd, durationMs})
```

## Contracts

```ts
// src/main/agent/AgentService.ts —— AgentServiceOptions 新增
settingSources?: Options['settingSources']                       // 默认 ['user','project','local']
buildSystemPromptAppend?: (ctx: { cwd: string; firstText: string }) => Promise<string>
onRunComplete?: (info: RunCompleteInfo) => void

export interface RunCompleteInfo {
  sessionId: string
  numTurns: number
  costUsd: number
  durationMs: number
}

// src/shared/types.ts —— AgentStatusEvent 扩展
export interface AgentStatusEvent {
  sessionId: string
  status: AgentStatus
  costUsd?: number
  durationMs?: number
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number }
  numTurns?: number
}
```

重入守卫：`pendingStart` 标志。`send()` 中 `if (this.query || this.pendingStart) → this.queue!.push(text)`——queue 在 `start()` 顶部同步创建，append await 期间到达的文本自然进入同一输入流。

**注意不设 `systemPrompt.snapshot`**：snapshot 会把 prompt 录制进会话转录并在整个会话期冻结——与"每次启动注入最新记忆"矛盾。append 无 snapshot 时每次启动重新渲染（sdk.d.ts 已验证）。

## Edge Cases

- append 解析抛异常 → 按 factory 同步异常同路径处理（agent:error + idle），不挂起。
- append await 期间 interrupt/dispose → `endCurrentQuery()` 清 pendingStart 与 queue，factory 未调用则不调用。
- usage 缺失（部分 result 无 usage）→ 字段可选，透传存在者。
- onRunComplete 回调抛异常 → consume() 已有 try/catch 兜底；回调本身以 `void` fire-and-forget 调用。

## Alternatives Considered

- **在渲染层注入记忆（首条 user 消息前缀）**：污染用户可见消息、不可缓存。否决。
- **SDK hooks（SessionStart）注入**：需配置 hooks 链且时机不可控（resume/compact 也会触发）。append 更直接。否决。
- **每次 send 重建 append**：破坏同一会话内 prompt 前缀稳定性。仅回合启动时构建。否决。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | tests/main/agent/AgentService.context.test.ts | lastOptions 含默认 settingSources；可覆盖 |
| AC-2 | 同上 | append 非空 → systemPrompt preset+append |
| AC-3 | 同上 | append 空/未提供 → 无 systemPrompt 键 |
| AC-4 | 同上 | append 挂起期间第二次 send → receivedInputs 两条、factory 一次 |
| AC-5 | 同上 + src/renderer/src/lib/applySdkMessage.test.ts | result.usage → agent:status → ChatState |
| AC-6 | 同上 | result → onRunComplete 恰好一次且字段正确 |
| AC-7 | src/renderer/src/components/chat/StatusBar.test.tsx | status-tokens 显示 |
