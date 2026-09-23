# Requirements: memory-rendering

## Overview

记忆链路的渲染层收敛：两条召回路径（app 注入的 `memory:recalled` 事件、SDK 原生 `memory_recall` 系统消息）汇入同一种内联 UiItem，在聊天流中以"从记忆中召回"块展示；上下文压缩边界（compact_boundary）显示为分隔线；蒸馏完成在状态栏显示"记忆 +N"徽标。仅内联展示，无管理面板。

## Stakeholders

- **用户**: 看见"AI 记得什么"（可解释性），理解回复为何带有跨会话上下文；感知自进化正在发生。
- **开发者**: 消费 memory-injection / memory-distillation 的事件与 SDK 消息流；所有渲染逻辑在 applySdkMessage 纯 reducer。

## Assumptions

- SDK memory_recall 消息经 agent:message 信封原样到达（主进程零改动）；在小模型代理下可能永不触发——app 路径为主。
- 回放历史会话时同一条召回消息会再次到达——必须去重。
- sessionExport 的穷尽 switch 编译会强制覆盖新 UiItem kind。

## Acceptance Criteria (EARS)

- AC-1: WHEN SDK memory_recall 消息到达, THE SYSTEM SHALL 追加 `{kind:'memory', source:'sdk'}` UiItem（按 uuid 去重；content 缺失时显示路径 basename）。
- AC-2: WHEN memory:recalled 事件到达, THE SYSTEM SHALL 经 applyMemoryRecalled 追加 `{kind:'memory', source:'app'}` UiItem，且按 memory id 去重（resume 重注入不重复）。
- AC-3: WHEN 聊天流渲染 memory 条目, THE SYSTEM SHALL 显示"从记忆中召回"标头与 kind 标签的条目列表（data-testid="memory-recall"，data-source 区分来源）。
- AC-4: WHEN SDKCompactBoundaryMessage 到达, THE SYSTEM SHALL 显示上下文压缩分隔线（data-testid="compact-boundary"）。
- AC-5: WHEN memory:distilled 事件到达, THE SYSTEM SHALL 在状态栏显示蒸馏徽标（data-testid="memory-distill"，"记忆 +N"）。
- AC-6: WHEN 会话导出, THE SYSTEM SHALL 新 kind 有确定性格式（memory → 引用块；compact → 分隔线标记）。
- AC-7: WHEN fake 模式 E2E 运行, THE SYSTEM SHALL 发送消息后看到 memory-recall 块，idle 后看到 memory-distill 徽标（零网络）。

## Out of Scope

- 记忆管理面板（用户已明确拒绝）。
- 手动"记住这条"入口。
- compact 的主进程干预（SDK 自治）。
