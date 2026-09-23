# Requirements: memory-distillation

## Overview

自进化核心：会话后自动蒸馏 harness 子循环。`MemoryDistiller` 在回合完成（onRunComplete）后触发，读取会话转录（中段截断控成本），用**独立的一次性侧查询**提取持久事实/用户偏好/教训/可复用操作模式，经窄校验与纯函数合并（memory-core）写入记忆库并发 `memory:distilled` 事件。侧查询与主会话物理隔离，任何失败都不影响主循环。

## Stakeholders

- **用户**: 应用越用越"懂我"（偏好被记住、教训不重犯）；蒸馏过程无感知、不打扰。
- **开发者**: 依赖 context-engineering 的 onRunComplete 接缝与 memory-core 的 merge/prune；事件由 memory-rendering 渲染。

## Assumptions

- 侧查询用 `query({prompt: string, options: {maxTurns: 1}})` 一次性字符串提示，无 resume / canUseTool / PromptQueue——不可能混入主会话流或触发权限弹窗。
- 转录读取用 SDK `getSessionMessages`；fake 模式注入 canned 转录（真实调用必败）。
- 蒸馏成本控制：minTurns 门槛（默认 2）+ 转录截断 24k 字符 + maxTurns:1 单查询。

## Acceptance Criteria (EARS)

- AC-1: WHEN numTurns 低于 minTurns（默认 2）, THE SYSTEM SHALL 跳过蒸馏且不发起侧查询。
- AC-2: IF 转录读取为空或抛异常, THE SYSTEM SHALL 静默跳过，不向调用方抛出任何异常。
- AC-3: WHEN 转录超长, THE SYSTEM SHALL 中段截断（保留头尾）后再组装蒸馏 prompt。
- AC-4: WHEN 发起侧查询, THE SYSTEM SHALL 传入字符串 prompt（含转录与现有候选条目）与 `{cwd, maxTurns: 1}`，且不携带 resume/canUseTool。
- AC-5: WHEN 模型返回 JSON 提案, THE SYSTEM SHALL 提取首个平衡 JSON 对象，丢弃非法条目（kind/content 越界）、钳制 content ≤500 字符与 confidence ∈ [0,1]，经 mergeEntries+prune 原子提交（store.replace）。
- AC-6: WHEN 蒸馏成功提交, THE SYSTEM SHALL 发送 `memory:distilled {sessionId, added, updated, retired}`。
- AC-7: IF 同一会话的蒸馏仍在进行（in-flight）, THE SYSTEM SHALL 跳过重复触发。
- AC-8: IF 侧查询流异常或 JSON 解析失败, THE SYSTEM SHALL 吞掉错误（log-and-stop），绝不影响主会话。
- AC-9: WHEN dispose 被调用（应用退出）, THE SYSTEM SHALL 中止在途侧查询。
- AC-10: WHEN APP_AGENT_MODE=fake, THE SYSTEM SHALL 使用 FakeDistiller 的确定性脚本（固定 JSON 提案 + result），使 E2E 零网络覆盖全链路。

## Out of Scope

- 蒸馏结果的注入与展示（memory-injection / memory-rendering spec）。
- 定时/后台整理（auto-dream 式巩固）——每次 onRunComplete 即时蒸馏。
- 蒸馏的手动触发 UI。
