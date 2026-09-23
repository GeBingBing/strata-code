# Requirements: sdk-mock

## Overview

SDK mock：为单测提供可脚本化的 `@anthropic-ai/claude-agent-sdk` query 替身。`createMockQuery(script)` 让测试在不启动真实 SDK 子进程的情况下，精确控制消息流、断言输入内容、捕获 query options，并支持中断与权限模式切换的 spy。

## Stakeholders

- **开发者**: 单测需要稳定、快速、可重复的 SDK 行为；mock 必须与真实 SDK 的 `Query` 接口形态一致。
- **CI**: mock 消除对外部 API 与本地子进程的依赖，保证流水线可复现。

## Assumptions

- 真实 SDK 的 `Query` 是 `AsyncIterable<SDKMessage>`，并暴露 `interrupt()`、`setPermissionMode(mode)`、`setModel(model)` 方法。
- `AgentService` 通过 `QueryFactory` 接缝注入 mock factory。
- 所有主进程层测试一律 mock SDK（CLAUDE.md 强制约定）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 测试调用 `createMockQuery(script)`, THE SYSTEM SHALL 返回 `{ factory, interrupt, setPermissionMode, setModel, receivedInputs, lastOptions }`。
- AC-2: WHEN mock factory 被调用, THE SYSTEM SHALL 按 `script` 数组顺序产出 `SDKMessage`。
- AC-3: WHEN `AgentService` 向 mock query 的输入流 push 消息, THE SYSTEM SHALL 在 `receivedInputs` 中记录每条 `SDKUserMessage`。
- AC-4: WHEN 测试调用 `mock.interrupt()` 或 `mock.setPermissionMode()`, THE SYSTEM SHALL 暴露 spy 以便断言被调用次数与参数。
- AC-5: WHEN mock factory 被调用时, THE SYSTEM SHALL 在 `lastOptions()` 中保存最近一次传入的 `options` 对象。
- AC-6: WHEN script 播完后调用迭代器 `next()`, THE SYSTEM SHALL 返回 `{ done: true }`，不抛异常。

## Out of Scope

- 模拟真实 SDK 的内部状态机（如 thinking tokens、tool 并行度）。
- 模拟网络延迟或流异常（由调用方在 script 中注入错误对象控制）。
- renderer 层测试不使用此 mock（渲染层用 `setIpcOverride` 注入 IPC 替身）。
