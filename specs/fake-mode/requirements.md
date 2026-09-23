# Requirements: fake-mode

## Overview

fake 模式：通过环境变量 `APP_AGENT_MODE=fake` 启动一个确定性的本地 agent，用于离线开发、CI 回归与 E2E 测试。该模式不调用真实 Anthropic API、不启动 SDK 子进程，能够以可预测的脚本回显用户输入并模拟一次工具调用回合。

## Stakeholders

- **用户**: 在没有 API key 或网络受限时仍能启动应用、验证 UI 流程。
- **开发者**: CI 与 E2E 必须零网络、零成本、可复现；fake 模式不能破坏真实 SDK 的接口形态。

## Assumptions

- 真实 SDK 的 `query({ prompt, options })` 返回 `Query`（AsyncIterable < SDKMessage >）。
- `APP_AGENT_MODE` 在应用启动前已设置（process.env 级别），运行中不切换。
- `AgentService` 通过 `QueryFactory` 接缝注入 fake 或真实工厂。
- E2E 启动脚本通过 `process.env.APP_AGENT_MODE = 'fake'` 强制 fake 模式。

## Acceptance Criteria (EARS)

- AC-1: WHEN `process.env.APP_AGENT_MODE` 等于 `'fake'`, THE SYSTEM SHALL 使用 `createFakeQueryFactory()` 构建查询，而非调用 `@anthropic-ai/claude-agent-sdk` 的 `query()`。
- AC-2: WHEN fake 模式运行时, THE SYSTEM SHALL 不发起任何网络请求，也不启动任何子进程。
- AC-3: WHEN fake agent 收到用户消息, THE SYSTEM SHALL 按固定脚本回显该消息并产出一次 `Read` 工具调用（含 tool_result 与 result(success)）。
- AC-4: WHEN CI 执行 `npm run test:e2e`, THE SYSTEM SHALL 在 fake 模式下完成全部 E2E 回归，无需真实 API key。
- AC-5: WHEN 渲染进程调用 `config:get`, THE SYSTEM SHALL 在 `agentMode` 字段返回 `'fake'`。

## Out of Scope

- fake 模式下切换模型、权限模式或工作目录的实时响应（这些仍走真实配置通道，fake agent 内部固定为 `model: 'fake-model'`, `permissionMode: 'default'`）。
- fake 模式支持多轮复杂工具调用链（MVP 仅固定单轮脚本）。
- 模拟网络错误、权限拒绝、流中断等异常路径（保留给 error-recovery spec）。
