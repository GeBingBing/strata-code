# Requirements: agent-service

## Overview

Agent 运行时核心：主进程的 `AgentService` 封装 Claude Agent SDK 的 `query()` 生命周期 — 每个会话一个流式查询，把 `SDKMessage` 异步流以带序号信封转发给渲染进程，支持发送提示、中断、权限模式切换。使用**流式输入模式**（`PromptQueue` 实现 `AsyncIterable<SDKUserMessage>`），这是 `interrupt()`/`setPermissionMode()` 中途可用的前提。

## Stakeholders

- **用户**: 期望流式打字机输出、可随时停止、低成本可见。
- **开发者**: chat-ui / permission-approval / session-history 都构建在 AgentService 的事件流之上；信封格式与 seq 语义必须稳定。

## Assumptions

- SDK `query({ prompt: AsyncIterable<SDKUserMessage>, options })` 返回 `Query`（`AsyncGenerator<SDKMessage>` + 控制方法）。
- 单测必须 mock SDK（真实 SDK 拉起子进程）；E2E 用 `APP_AGENT_MODE=fake` 切换到 `createMockQuery`。
- `includePartialMessages: true` 开启时 partial 与 final 消息都会到达（按消息 id 去重在渲染层处理）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 渲染进程调用 `agent:send {text}`, THE SYSTEM SHALL 将其作为 `SDKUserMessage` 推入当前查询的输入流。
- AC-2: WHEN SDK 流产出任一条 `SDKMessage`, THE SYSTEM SHALL 以 `{sessionId, seq, message}` 信封经 `agent:message` 发给渲染进程，且 seq 单调递增。
- AC-3: WHEN 渲染进程调用 `agent:interrupt`, THE SYSTEM SHALL 调用 `query.interrupt()` 并停止当前回合。
- AC-4: WHEN 查询正常结束（收到 `SDKResultMessage`）, THE SYSTEM SHALL 发送 `agent:status {status:'idle', …}` 并保留 cost/时长信息。
- AC-5: IF 查询流抛出异常, THE SYSTEM SHALL 发送 `agent:error`（含错误消息）并回到 idle 状态，不使主进程崩溃。
- AC-6: WHEN SDK 发出携带 session id 的系统消息, THE SYSTEM SHALL 捕获该 id 并在后续信封与状态事件中一致使用。
- AC-7: WHEN 渲染进程调用 `agent:setPermissionMode {mode}`, THE SYSTEM SHALL 调用 `query.setPermissionMode(mode)`。
- AC-8: IF 会话被销毁（切换/退出）, THE SYSTEM SHALL 中止底层查询（abortController.abort()）并清理资源，不遗留悬挂的子进程。

## Out of Scope

- 权限批准 UI 流程（permission-approval spec）。
- 会话持久化与恢复（session-history spec）— 本 spec 仅捕获 session id。
