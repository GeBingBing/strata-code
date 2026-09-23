# Design: memory-distillation

## Context

[requirements.md](./requirements.md) — 前沿 agent 的"harness 子循环"模式：主循环（对话）之外，harness 调度轻量子循环做自进化（蒸馏）。蒸馏器 = 触发守卫 + 转录获取 + prompt 组装 + 侧查询 + 窄校验 + 纯函数巩固。

## Data Flow

```
AgentService.consume() ──result──→ onRunComplete(info)（fire-and-forget）
                                      │
                            MemoryDistiller.onRunComplete(info)
                              ├─ 守卫: in-flight? / numTurns < minTurns?  → skip
                              ├─ readTranscript(sessionId) → 空/异常 → skip (AC-2)
                              ├─ 中段截断 → 24k chars (AC-3)
                              ├─ buildDistillPrompt(转录, 现有候选条目)
                              ├─ 侧查询: queryFactory({prompt: string, options: {cwd, maxTurns:1, …}}) (AC-4)
                              ├─ 收集末条 assistant 文本 → extractJson → 窄校验 (AC-5)
                              ├─ mergeEntries + prune → store.replace (AC-5)
                              └→ win.send('memory:distilled', {sessionId, added, updated, retired}) (AC-6)
```

每一步包在 try/catch 中：失败 log-and-stop，绝不向上抛（AC-8）。

## Contracts

```ts
// src/main/memory/MemoryDistiller.ts
export type DistillQueryFactory = (params: {
  prompt: string
  options: Options
}) => Query

export interface RunCompleteInfo { sessionId: string; numTurns: number; costUsd: number; durationMs: number }

export interface MemoryDistillerOptions {
  store: MemoryStore
  queryFactory: DistillQueryFactory
  win: WebContentsLike
  cwd: () => string
  readTranscript: (sessionId: string) => Promise<unknown[]>
  minTurns?: number              // 默认 2
  maxTranscriptChars?: number    // 默认 24000
}

export class MemoryDistiller {
  async onRunComplete(info: RunCompleteInfo): Promise<void>  // NEVER throws
  dispose(): void
}

// src/main/memory/distillPrompt.ts
export function truncateMiddle(text: string, maxChars: number): string
export function buildDistillPrompt(transcript: string, existing: MemoryEntry[]): string
export function extractJson(text: string): unknown | null
export function validateDrafts(raw: unknown, sourceSessionId: string, now: number): { add: MemoryEntry[]; retire: string[] }
```

侧查询 options（AC-4）：`{cwd, maxTurns: 1, permissionMode: 'default', abortController, systemPrompt: {type:'preset', preset:'claude_code', append: DISTILLER_APPEND}}`——无 resume / canUseTool / includePartialMessages。

输出 schema（prompt 中声明，`validateDrafts` 校验）：

```json
{"add": [{"kind": "fact|preference|lesson|skill", "scope": "global|project", "content": "…",
          "confidence": 0.0, "tags": ["…"]}], "retire": ["<existing entry id>"]}
```

**FakeDistiller**（`src/main/agent/FakeDistiller.ts`）：`createFakeDistillQueryFactory()` 产出固定脚本——assistant（文本为固定 JSON 提案，含 1 条 preference）+ result(success)。index.ts 在 fake 模式注入 canned 转录。

## Edge Cases

- FakeAgent 的 result `num_turns` 提升为 2 → fake 模式无需调低 minTurns（一处特例消除）。
- in-flight 按 sessionId 记录；完成后清理（finally）。
- dispose 后到达的 onRunComplete → 直接跳过。
- 现有候选条目最多带 20 条进 prompt（控制成本），超出按 updatedAt 降序截断。
- extractJson 容错：剥 ```json 栅栏 → 首个平衡 `{}` 对象 → 失败返回 null（调用方按解析失败处理）。
- 同一 store 的并发替换安全由 MemoryStore 临界区串行化保证（memory-core AC-3）。

## Alternatives Considered

- **复用主会话流注入蒸馏指令**：污染对话上下文、受 maxTurns 干扰。独立侧查询。否决。
- **定时后台批量蒸馏**（auto-dream 式）：延迟记忆生效且需调度器；MVP 即时蒸馏，够用。否决。
- **让蒸馏查询带 canUseTool**：会触发权限弹窗打扰用户；maxTurns:1 + 强 JSON 约束封顶。否决（若代理上失控再加 disallowedTools）。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | tests/main/memory/MemoryDistiller.test.ts | numTurns=1 → factory 未调用 |
| AC-2 | 同上 | readTranscript 空 / reject → 不抛、无 store 写入 |
| AC-3 | 同上 | 长转录 → prompt 含头尾、缺中段（长度受限） |
| AC-4 | 同上 | factory 收到 string prompt + options {maxTurns:1, cwd}，无 resume/canUseTool |
| AC-5 | 同上 | 合法 JSON → store.replace 调用且经 merge/prune；非法条目丢弃；content/confidence 钳制 |
| AC-6 | 同上 | memory:distilled 事件 {added, updated, retired} |
| AC-7 | 同上 | 挂起中的同 session 二次触发 → factory 只调一次 |
| AC-8 | 同上 | factory 抛异常 / JSON 全烂 → 吞掉不抛 |
| AC-9 | 同上 | dispose → abortController.abort 调用 |
| AC-10 | tests/main/agent/FakeDistiller.test.ts | 脚本产出固定 JSON 提案 + result；FakeAgent num_turns=2 |
