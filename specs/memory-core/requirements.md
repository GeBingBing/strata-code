# Requirements: memory-core

## Overview

记忆系统的数据基座：定义 `MemoryEntry` 数据模型（语义记忆 fact/preference/lesson + 程序性记忆 skill，分 global/project 两个作用域），提供 `MemoryStore`（userData/memory.json 原子持久化）与**纯函数**合并/淘汰逻辑（`mergeEntries`/`prune`）。蒸馏 LLM 只负责"提案"，确定性纯函数决定合并/淘汰——巩固逻辑完全可单测、模型无关。

## Stakeholders

- **用户**: 记忆条目不丢失、不重复、不过期膨胀；损坏的记忆文件不能拖垮应用。
- **开发者**: memory-injection / memory-distillation 构建在本 spec 之上；数据模型与合并语义必须稳定。

## Assumptions

- 记忆文件为 `<userData>/memory.json`，形如 `{version: 1, entries: MemoryEntry[]}`。
- 蒸馏器与 list/delete 可能并发访问存储（后台子循环），持久化必须串行化。
- 无第三方依赖：id 生成用时间戳 36 进制 + 随机段，相似度用 token 集 Jaccard。

## Acceptance Criteria (EARS)

- AC-1: WHEN 记忆文件缺失或损坏, THE SYSTEM SHALL 以空库启动且不抛出异常。
- AC-2: WHEN `upsert` 传入已存在 id, THE SYSTEM SHALL 更新该条目并保留原 createdAt。
- AC-3: WHEN 并发调用多个写方法, THE SYSTEM SHALL 串行化持久化，不丢失任何一次更新。
- AC-4: WHEN `mergeEntries` 收到与现有条目同 kind 且同有效作用域、且（id 相等或规范化内容相等或 Jaccard ≥ 0.8）的提案, THE SYSTEM SHALL 合并为一条：保留更长 content、confidence +0.15（上限 0.99）、hits + 1、tags 取并集、updatedAt 刷新。
- AC-5: IF 提案与现有条目跨 kind 或跨作用域（scope/cwd 不同）, THE SYSTEM SHALL 两条并存，不做合并。
- AC-6: WHEN `mergeEntries` 收到 retireIds, THE SYSTEM SHALL 移除对应条目并在返回计数中报告 `{added, updated, retired}`。
- AC-7: WHEN 某 kind 条目数超过上限, THE SYSTEM SHALL 按 confidence × 新近度升序淘汰超额条目（`prune`）。
- AC-8: WHEN `replace` 写入整批条目, THE SYSTEM SHALL 原子替换全部内容（蒸馏器批量提交）。

## Out of Scope

- 记忆的注入时机与格式（memory-injection spec）。
- 蒸馏 LLM 调用与提案解析（memory-distillation spec）。
- 记忆管理 UI（用户已决定不做面板）。
