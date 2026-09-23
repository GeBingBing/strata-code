# Requirements: file-context-mentions

## Overview

在 Composer 中支持 `@` 提及文件、文件夹或代码行范围，把用户明确选择的上下文附加到当前用户消息。被附加的文件会显示为 chips，并随用户消息一起进入 Agent 的 prompt。

## Stakeholders

- **用户**: 能精确地把文件、目录或代码片段加入对话，让 Agent 聚焦在相关代码上。
- **开发者**: `UiItem.user` 增加 `attachments` 字段；新 UI 组件与 prompt 组装逻辑纯函数化，便于测试。

## Assumptions

- `workspace-management` 已完成，存在活跃工作区与 `workspaceStore`。
- `chat-ui` 已完成，`UiItem` 是渲染层唯一事实源。
- Agent 的 prompt 由主进程在收到 `agent:send` 后组装（避免把文件读取逻辑放到渲染层）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户在 Composer 输入框中输入 `@`, THE SYSTEM SHALL 弹出可键盘导航的文件/文件夹选择器。
- AC-2: WHEN 用户从选择器选中某文件或文件夹, THE SYSTEM SHALL 把它作为 attachment chip 渲染在输入框上方。
- AC-3: WHEN 用户发送带有 attachments 的消息, THE SYSTEM SHALL 在聊天历史中显示该用户消息及其 attachment chips。
- AC-4: WHEN 主进程收到 `agent:send` 且 payload 包含 attachments, THE SYSTEM SHALL 读取对应文件内容（文件夹则展开其下文件）并拼接到 prompt 中发给 SDK。
- AC-5: WHEN 用户导出会话, THE SYSTEM SHALL 在 Markdown/JSON 中保留 attachments 信息。
- AC-6: IF 被提及的文件过大或二进制, THE SYSTEM SHALL 在 prompt 中保留路径与元数据，而不是读取全文。

## Out of Scope

- 代码片段/行范围选择（range mention）的 UI 拖拽选择（MVP 只支持整个文件/文件夹）。
- 自动保持 attachments 与磁盘变更同步（重新发送前手动刷新）。
- 多工作区跨区附件（附件路径必须落在当前工作区内）。
