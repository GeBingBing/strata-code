# Requirements: thinking-display

## Overview

thinking 块显示：当 SDK 返回 `thinking` 类型 content block 时，在聊天界面以可折叠区域展示 agent 的推理过程。这对应 Cursor/Codex 中常见的"思考过程"UX，帮助用户理解模型如何得出结论。

## Stakeholders

- **用户**: 需要看到模型推理过程，尤其在复杂编程任务中。
- **开发者**: thinking 块是 content block 的一种，不应破坏现有的 partial/final 消息折叠逻辑。

## Assumptions

- `chat-ui` 已支持 text / tool_use / tool_result content block 的渲染。
- `applySdkMessage` 已能读取 `ContentBlock.thinking` 字段（当前已实现读取但未渲染）。

## Acceptance Criteria (EARS)

- AC-1: WHEN assistant 消息包含 `thinking` content block, THE SYSTEM SHALL 在消息气泡内渲染可折叠的 thinking 区域。
- AC-2: WHEN thinking 区域折叠, THE SYSTEM SHALL 显示摘要行（如"思考过程"）。
- AC-3: WHEN thinking 区域展开, THE SYSTEM SHALL 以等宽字体显示 thinking 文本。
- AC-4: WHEN thinking block 与 text block 同时存在, THE SYSTEM SHALL 先显示 thinking（折叠）再显示正式回复。
- AC-5: IF thinking 文本为空, THE SYSTEM SHALL 不渲染 thinking 区域。

## Out of Scope

- thinking 块的 token 成本单独统计。
- thinking 块语法高亮或 Markdown 渲染。
- 用户配置默认展开/折叠 thinking。
