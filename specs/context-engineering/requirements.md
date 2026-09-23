# Requirements: context-engineering

## Overview

Harness 层的上下文工程升级：为 `AgentService` 增加三个**记忆无关**的接缝——显式 `settingSources`（CLAUDE.md 项目记忆加载）、`buildSystemPromptAppend`（system prompt 追加段组装）、`onRunComplete`（回合完成回调）——并把 SDK result 消息中的 token 用量（usage/num_turns）透传到渲染层状态栏。这是 memory-injection / memory-distillation 的插头。

## Stakeholders

- **用户**: 看到 token 消耗；项目 CLAUDE.md 的指令记忆生效。
- **开发者**: memory-injection（buildSystemPromptAppend 消费方）、memory-distillation（onRunComplete 消费方）依赖本 spec 的接缝；接缝语义必须记忆无关、可独立测试。

## Assumptions

- `systemPrompt: {type:'preset', preset:'claude_code', append}` 为客户端拼接，第三方 base URL 可用；**不设 snapshot**（append 每次启动重新生效，进化式记忆所需）。
- `settingSources` 省略时 SDK 默认加载全部来源（含 CLAUDE.md）——本 spec 将其显式化为 `['user','project','local']`，行为不变但可断言。
- `SDKResultMessage` 携带 `usage`（input/output/cache tokens）与 `num_turns`。

## Acceptance Criteria (EARS)

- AC-1: WHEN 构造查询 Options, THE SYSTEM SHALL 显式携带 `settingSources`（默认 `['user','project','local']`，可由调用方覆盖）。
- AC-2: WHEN `buildSystemPromptAppend` 返回非空字符串, THE SYSTEM SHALL 在 Options 中携带 `systemPrompt: {type:'preset', preset:'claude_code', append}`。
- AC-3: WHEN `buildSystemPromptAppend` 返回空字符串或未提供, THE SYSTEM SHALL 不携带 systemPrompt 键（保持缓存前缀稳定）。
- AC-4: WHEN append 解析（await）期间渲染进程再次 send, THE SYSTEM SHALL 将新文本推入同一输入流且 queryFactory 仅调用一次（重入守卫）。
- AC-5: WHEN 收到 result 消息, THE SYSTEM SHALL 在 `agent:status` 中透传 `usage`（input/output/cache tokens）与 `numTurns`。
- AC-6: WHEN 回合正常结束（result 消息）, THE SYSTEM SHALL 以 `{sessionId, numTurns, costUsd, durationMs}` 恰好一次回调 `onRunComplete`（fire-and-forget，不阻塞事件流）。
- AC-7: WHEN 渲染层收到含 usage 的状态, THE SYSTEM SHALL 在状态栏显示 token 用量。

## Out of Scope

- 记忆条目的选择与 append 内容格式（memory-injection spec）。
- 蒸馏触发后的处理（memory-distillation spec）。
- 上下文压缩（compaction）的主进程干预——SDK 自治，渲染层仅展示（memory-rendering spec）。
