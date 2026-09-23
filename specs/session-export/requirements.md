# Requirements: session-export

## Overview

会话导出：允许用户复制单条消息或导出整个会话为 Markdown / JSON，便于分享、存档或在外部工具中继续编辑。本功能在 `chat-ui` 与 `session-history` 之上增加导出入口，不修改现有消息流状态。

## Stakeholders

- **用户**: 需要保存有价值的多轮对话、分享结果、或在其他编辑器中继续处理。
- **开发者**: 导出功能不应阻塞主线程；大会话导出需异步处理。

## Assumptions

- `chat-ui` 已维护 `UiItem[]` 消息列表。
- `session-history` 已提供 `sessions:read` 读取完整 SDK 转录。
- Electron 的 `clipboard` API 与文件对话框可用于复制/保存。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户点击 assistant 或 user 消息的"复制"按钮, THE SYSTEM SHALL 将该消息的 markdown / raw 文本写入剪贴板。
- AC-2: WHEN 用户选择"导出会话为 Markdown", THE SYSTEM SHALL 生成包含所有消息的 Markdown 文件并触发保存对话框。
- AC-3: WHEN 用户选择"导出会话为 JSON", THE SYSTEM SHALL 生成包含完整 `UiItem[]` 或 SDK 转录的 JSON 文件并触发保存对话框。
- AC-4: WHEN 导出 Markdown 时, THE SYSTEM SHALL 用清晰的标题/代码块/工具调用摘要区分用户消息、assistant 消息与工具结果。
- AC-5: IF 用户取消保存对话框, THE SYSTEM SHALL 不报错、不生成文件。

## Out of Scope

- 导出为 PDF / Word / HTML。
- 自动上传到云端或分享服务。
- 跨会话批量导出。
