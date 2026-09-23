# Design: memory-core

## Context

[requirements.md](./requirements.md) — 记忆分层对齐前沿智能体设计：**指令记忆**（CLAUDE.md，由 SDK settingSources 加载，属 context-engineering spec）、**语义记忆**（fact/preference/lesson）、**程序性记忆**（skill，"When 触发条件: 操作模式"）。本 spec 只做后两者的数据基座。

## Data Flow

```
MemoryDistiller 提案 drafts ──┐
                              ├→ mergeEntries(纯函数) → prune(纯函数) → MemoryStore.replace()
MemoryStore.list() ←──────────┘                                        │
     │                                                                 ↓
MemoryInjector 选条目                                          userData/memory.json（原子写）
```

## Contracts

```ts
// src/shared/types.ts
export type MemoryKind = 'fact' | 'preference' | 'lesson' | 'skill'
export type MemoryScope = 'global' | 'project'

export interface MemoryEntry {
  id: string                // `${kind}-${createdAt36}-${rand4}`
  kind: MemoryKind
  scope: MemoryScope
  cwd: string | null        // project 作用域锚点；global 为 null
  content: string           // 蒸馏语句（建议 ≤200 字符，硬上限 500）
  confidence: number        // 0..1，新条目 0.6
  hits: number              // 被再次确认次数
  tags: string[]            // 主题关键词；skill 的触发条件
  sourceSessionId: string
  createdAt: number
  updatedAt: number
}

// src/main/memory/merge.ts（纯函数，无 I/O）
export function normalizeContent(s: string): string          // trim + 空白折叠（仅比较用）
export function similarity(a: string, b: string): number     // token 集 Jaccard
export function mergeEntries(
  existing: MemoryEntry[],
  incoming: MemoryEntry[],
  retireIds: string[],
  now: number
): { entries: MemoryEntry[]; added: number; updated: number; retired: number }
export function prune(
  entries: MemoryEntry[],
  caps?: Partial<Record<MemoryKind, number>>   // 默认 {fact:50, preference:30, lesson:30, skill:20}
): MemoryEntry[]

// src/main/memory/MemoryStore.ts
export class MemoryStore {
  constructor(filePath: string)
  list(): Promise<MemoryEntry[]>
  upsert(entry: MemoryEntry): Promise<void>
  delete(id: string): Promise<void>
  replace(entries: MemoryEntry[]): Promise<void>   // 蒸馏器批量原子提交 (AC-8)
}
```

合并匹配规则（AC-4/5）：同 `kind` 且同有效作用域（scope 相等，project 时 cwd 相等）前提下，`id` 相等 / `normalizeContent` 相等 / `similarity ≥ 0.8` 任一命中即合并。

## Edge Cases

- 损坏 JSON → 空库（沿用 SessionStore 的 try/catch 回空模式）。
- 并发写：`persist()` 经 promise 链互斥（写互斥），`load()` 只执行一次。
- `prune` 淘汰排序键：`confidence × exp(-(now - updatedAt) / HALF_LIFE)`，HALF_LIFE = 30 天。
- `retireIds` 中不存在的 id 静默忽略，但只对实际移除的计数（AC-6）。
- merge 时 incoming 缺省字段（confidence/hits/tags）按新条目默认值补齐后再入队。

## Alternatives Considered

- **每条记忆一个 markdown 文件**（Claude Code auto-memory 风格）：对 CLI 生态友好，但桌面应用内需要批量打分/合并，单 JSON 库 + 内存缓存更简单且可原子提交。否决。
- **SQLite**：无原生依赖诉求下过度设计。否决。
- **embedding 相似度**：需模型调用，破坏离线可测性；Jaccard 对蒸馏语句（短、同源）足够。否决。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | tests/main/memory/MemoryStore.test.ts | 缺失/损坏 JSON → `[]` |
| AC-2 | 同上 | upsert 已存在 id → 更新且保留 createdAt |
| AC-3 | 同上 | 交替并发 upsert/delete → 重新加载后两次更新均在 |
| AC-4 | tests/main/memory/merge.test.ts | 精确重复 / Jaccard ≥ 0.8 合并；字段演化断言 |
| AC-5 | 同上 | 跨 kind / 跨 cwd 不合并 |
| AC-6 | 同上 | retireIds 移除 + 计数 |
| AC-7 | 同上 | 超上限按 confidence×recency 淘汰 |
| AC-8 | tests/main/memory/MemoryStore.test.ts | replace 后重新加载内容一致 |
