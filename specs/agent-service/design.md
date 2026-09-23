# Design: agent-service

## Context

实现 [requirements.md](./requirements.md)。核心是三个类：`PromptQueue`（流式输入）、`AgentService`（生命周期 + 信封）、`createMockQuery`（测试替身）。

## Data Flow / Architecture

```
Renderer                 Main (AgentService)              SDK
   │ agent:send ─────────►│ PromptQueue.push(text) ─┐
   │                      │                          ▼ (AsyncIterable<SDKUserMessage>)
   │                      │                        query() ──► Query
   │                      │                          │  SDKMessage 流
   │ agent:message ◄──────│ envelope{sessionId,seq} ◄┘
   │ agent:status  ◄──────│ on result / idle
   │ agent:interrupt ────►│ query.interrupt()
   │ agent:setPermissionMode ─► query.setPermissionMode(mode)
```

## Contracts

```ts
// 信封 — 渲染层按 seq 排序/去重
type AgentEnvelope = { sessionId: string; seq: number; message: SDKMessage }
type AgentStatus = 'idle' | 'running' | 'error'

// invoke 通道
'agent:send':             (p: { sessionId?: string; text: string }) => Promise<void>
'agent:interrupt':        () => Promise<void>
'agent:setPermissionMode':(p: { mode: PermissionMode }) => Promise<void>
// event 通道
'agent:message': AgentEnvelope
'agent:status':  { sessionId: string; status: AgentStatus; costUsd?: number; durationMs?: number }
'agent:error':   { sessionId: string; error: string }

// 可注入查询工厂（fake 模式 / 测试的关键接缝）
type QueryFactory = (params: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => Query
```

## Edge Cases

- 查询进行中再次 `agent:send` → 排队进同一输入流（多轮），不新开查询。
- 会话无查询时 `agent:send` → 惰性启动新查询。
- `interrupt()` 在查询未运行 → no-op，不抛异常。
- 生成器结束但没收到 result 消息 → 仍发 idle（容错）。
- 主窗口销毁 → dispose 全部查询（AC-8）。

## Alternatives Considered

- 每次发送一个短命 `query()`（字符串 prompt）：实现更简单，但 `interrupt()`/`setPermissionMode()` 不可用且每轮重启进程开销大 — 否决。
- 在渲染进程直连 SDK：SDK 需要 Node 运行时与文件系统访问，渲染进程沙箱不允许 — 否决。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `tests/main/agent/PromptQueue.test.ts` | push 产出 SDKUserMessage、迭代等待、多轮顺序 |
| AC-2/4/6 | `tests/main/agent/AgentService.test.ts` | 信封 seq 递增、result→idle+cost、session id 捕获 |
| AC-3/7 | `tests/main/agent/AgentService.test.ts` | interrupt/setPermissionMode 代理到 Query 间谍 |
| AC-5 | `tests/main/agent/AgentService.test.ts` | 流异常 → agent:error + 状态复位 |
| AC-8 | `tests/main/agent/AgentService.test.ts` | dispose → abortController.abort 被调用 |
| E2E | `tests/e2e/chat.spec.ts` | fake 模式全链路 |
