# Requirements: error-recovery

## Overview

错误恢复：当 agent 查询因网络、权限或 SDK 异常失败时，为用户提供明确的重试与重新生成入口，避免对话因一次错误而中断。重试与重新生成必须保留当前会话上下文，不得因新建会话而丢失会话标题与历史。

## Stakeholders

- **用户**: 查询失败时不应丢失上下文；能一键重试最后一条消息或重新生成 assistant 回复；会话标题与历史保持连续。
- **开发者**: 重试/重新生成复用 `agent:send` 的 resume 语义；UI 层只负责截断本地条目。

## Assumptions

- `agent-service` 已提供 `agent:send/interrupt` 与 `agent:error` 事件；`agent:send` 携带 `sessionId` 时为主进程 resume 语义。
- `chat-ui` 已维护消息列表 `UiItem[]` 与运行状态。
- SDK 不支持从转录中段重写；重复 user 消息会出现在转录中，重开会话时可见，可接受。

## Acceptance Criteria (EARS)

- AC-1: WHEN 查询以 `agent:error` 结束, THE SYSTEM SHALL 在输入框区域显示"重试"按钮。
- AC-2: WHEN 用户点击"重试", THE SYSTEM SHALL 截断本地条目至最后一条用户消息之前，并以相同 `sessionId` 重新发送该用户消息及其附件。
- AC-3: WHEN assistant 已生成至少一条消息, THE SYSTEM SHALL 在该消息旁显示"重新生成"按钮。
- AC-4: WHEN 用户点击"重新生成", THE SYSTEM SHALL 截断本地条目至该 assistant 消息的前置用户消息之前，并以相同 `sessionId` 重新发送。
- AC-5: WHEN 重试/重新生成发送, THE SYSTEM SHALL 保留 `sessionStore.activeId`，不创建新会话。
- AC-6: IF 重试/重新生成再次失败, THE SYSTEM SHALL 继续显示错误条目与重试入口，不进入死循环。

## Out of Scope

- 自动重试（指数退避）。
- 从 SDK 转录中删除旧回合（无 API；接受转录含重复 user 消息）。
- 网络状态检测与离线模式 UI。
