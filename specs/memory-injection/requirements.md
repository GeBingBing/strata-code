# Requirements: memory-injection

## Overview

会话启动时的记忆召回与注入：`MemoryInjector` 从 MemoryStore 选取相关条目（作用域过滤 + 首条消息 tag 重叠打分，无需 embedding，模型无关），组装为 `<memory>` 段经 `buildSystemPromptAppend` 注入 system prompt，同时发 `memory:recalled` 事件供渲染层内联展示"从记忆中召回"。

## Stakeholders

- **用户**: 新会话能"记得"跨会话的偏好/事实/教训；看到召回内容，理解回答为何带有上下文。
- **开发者**: 消费 context-engineering 的 buildSystemPromptAppend 接缝；memory:recalled 事件由 memory-rendering spec 渲染。

## Assumptions

- 注入发生在**回合启动时**（start() 的 append 解析），同会话内 prompt 前缀保持稳定。
- 打分只用确定性信号（tag 重叠、confidence、新近度）——离线可测。
- 空选时不注入任何 systemPrompt 键（context-engineering AC-3）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 记忆库为空或无匹配条目, THE SYSTEM SHALL 返回空字符串且不发送 memory:recalled 事件。
- AC-2: WHEN 条目为 project 作用域, THE SYSTEM SHALL 仅当其 cwd 等于或为当前 cwd 的前缀（父目录）时入选；global 恒入选候选。
- AC-3: WHEN 打分排序, THE SYSTEM SHALL 以 `tag 与首条用户消息的重叠数 ×2 + confidence + 新近度加成` 降序选取，非 skill 条目至多 12 条、skill 至多 4 条，总字符预算 2000。
- AC-4: WHEN 组装 append, THE SYSTEM SHALL 产出含 Preferences/Facts/Lessons/Skills 分区的 `<memory>` 段，skill 行为 "When <触发 tags>: <content>" 格式，并声明"背景信息可能过时"。
- AC-5: WHEN 选中条目非空, THE SYSTEM SHALL 在 query 启动前发送 `memory:recalled {sessionId, source:'app', memories:[{id,kind,content}]}`（sessionId 未捕获时为 ''）。
- AC-6: IF store.list() 抛异常, THE SYSTEM SHALL 返回空字符串且不使回合启动失败。

## Out of Scope

- 记忆的写入/蒸馏（memory-distillation spec）。
- memory:recalled 的渲染（memory-rendering spec）。
- embedding / 语义向量检索。
