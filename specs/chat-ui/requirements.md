# Requirements: chat-ui

## Overview

聊天界面：流式渲染 agent 回复（打字机效果）、用户输入框、停止按钮、工具调用卡片、markdown 渲染。核心是一个纯 reducer `applySdkMessage` — 把 SDKMessage 流折叠为 UI 状态，完全可单测，不依赖 React。

## Stakeholders

- **用户**: 需要流畅的流式输出、清晰看到 agent 正在调用什么工具、能随时停止。
- **开发者**: reducer 是渲染层的唯一复杂逻辑；组件保持薄。

## Assumptions

- `includePartialMessages: true` 开启时 partial（流式增量）与 final 消息都会到达 — **按消息 id 去重**。
- 工具生命周期：assistant 消息中的 `tool_use` block → 创建工具条目；后续 user 消息中的 `tool_result` → 标记完成。

## Acceptance Criteria (EARS)

- AC-1: WHEN 收到 SDKPartialAssistantMessage（text_delta）, THE SYSTEM SHALL 追加到当前流式气泡并显示打字机光标。
- AC-2: WHEN 收到 SDKAssistantMessage（final）, THE SYSTEM SHALL 以其完整内容替换同 id 的流式气泡（去重，不重复渲染）。
- AC-3: WHEN assistant 消息包含 tool_use block, THE SYSTEM SHALL 创建工具卡片条目（工具名、参数、running 状态）。
- AC-4: WHEN 收到对应 tool_result, THE SYSTEM SHALL 将该工具条目置为 success/error 并记录输出摘要。
- AC-5: WHEN 收到 SDKResultMessage, THE SYSTEM SHALL 将会话状态置为 idle 并显示 cost/时长。
- AC-6: WHEN 用户在 agent 运行时点击停止, THE SYSTEM SHALL 调用 agent:interrupt 并禁用发送。
- AC-7: WHEN 用户在输入框提交文本, THE SYSTEM SHALL 立即以用户气泡渲染（乐观 UI）并调用 agent:send。
- AC-8: IF agent:error 到达, THE SYSTEM SHALL 在消息流中显示错误条目并恢复输入可用。
- AC-9: WHEN 流式气泡渲染, THE SYSTEM SHALL 以 markdown 实时渲染当前累积文本（Cursor 式，含代码块/列表/标题），并保留打字机光标。
- AC-10: WHEN 高频 text_delta 到达, THE SYSTEM SHALL 将 markdown 重渲染节流至 ~50ms 一次（`useThrottledValue`），且流式结束时渲染最终完整文本。

## Out of Scope

- diff 预览与批准 UI（diff-approval spec）。
- 会话侧栏（session-history spec）。
- 工作目录、权限模式、模型选择器与配置面板（app-config spec）。
