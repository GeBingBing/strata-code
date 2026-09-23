# Requirements: session-search-and-grouping

## Overview

会话搜索与分组：在左侧会话侧栏顶部提供搜索框，按标题过滤历史会话；并将过滤后的会话按更新时间分为「今天 / 昨天 / 更早」三组，帮助用户在会话增多时快速定位。

## Stakeholders

- **用户**: 会话数量增加后需要快速搜索与按时间回顾。
- **开发者**: 过滤与分组是纯渲染层逻辑，不应影响 `session-history` 的索引与持久化。

## Assumptions

- `session-history` 已提供 `SessionSummary[]` 列表，包含 `title` 与 `updatedAt`。
- 分组以本地时间 `updatedAt` 为准。

## Acceptance Criteria (EARS)

- AC-1: WHEN 会话侧栏渲染时, THE SYSTEM SHALL 在「新对话」按钮下方显示搜索输入框。
- AC-2: WHEN 用户在搜索框输入文本, THE SYSTEM SHALL 按会话标题包含该文本（不区分大小写）过滤列表。
- AC-3: WHEN 过滤后的列表为空, THE SYSTEM SHALL 显示「无匹配会话」提示。
- AC-4: WHEN 会话列表渲染时, THE SYSTEM SHALL 按 updatedAt 将条目分为「今天 / 昨天 / 更早」三组。
- AC-5: WHEN 某分组没有会话, THE SYSTEM SHALL 隐藏该分组标题。
- AC-6: WHEN 用户点击过滤后的会话, THE SYSTEM SHALL 触发与未过滤时相同的打开行为。

## Out of Scope

- 全文搜索会话内容（仅按标题过滤）。
- 按项目（cwd）分组（当前仅按时间分组）。
- 排序选项（当前固定按 updatedAt 降序，由 session-history 保证）。
