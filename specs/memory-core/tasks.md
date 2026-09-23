# Tasks: memory-core

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. 类型与 MemoryStore

- [x] 1.1 失败测试: 缺失/损坏 JSON → list() 返回 []；upsert 新增 + 已存在 id 更新且保留 createdAt；replace 批量原子替换（重新 new MemoryStore 读回）→ `tests/main/memory/MemoryStore.test.ts` (AC-1/2/8)
- [x] 1.2 失败测试: 并发 upsert（写互斥）不丢更新 → 同上 (AC-3)
- [x] 1.3 实现 `src/shared/types.ts` 新增 MemoryKind/MemoryScope/MemoryEntry + `src/main/memory/MemoryStore.ts`（SessionStore 模式 + 临界区串行化 + replace()）

## 2. merge 纯函数

- [x] 2.1 失败测试: normalizeContent 精确重复 → 合并（confidence +0.15 上限 0.99、hits+1、updatedAt 刷新、tags 并集、保留更长 content）→ `tests/main/memory/merge.test.ts` (AC-4)
- [x] 2.2 失败测试: Jaccard ≥ 0.8 近重复合并；< 0.8 两条保留；跨 kind / 跨 cwd 不合并 → 同上 (AC-4/5)
- [x] 2.3 失败测试: retireIds 移除 + {added, updated, retired} 计数正确；未知 id 静默忽略 → 同上 (AC-6)
- [x] 2.4 失败测试: prune 按 kind 上限，超额按 confidence×recency 升序淘汰 → 同上 (AC-7)
- [x] 2.5 实现 `src/main/memory/merge.ts`（normalizeContent/similarity/mergeEntries/prune）

> 备注：AC-3 的实现从"仅 persist 互斥"升级为 load→mutate→persist 整个临界区串行化（enqueue promise 链）——首跑曾出现 delete/upsert 乱序导致条目复活的竞态，8 次连跑验证稳定。
