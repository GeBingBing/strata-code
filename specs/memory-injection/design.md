# Design: memory-injection

## Context

[requirements.md](./requirements.md) — 对齐前沿智能体的"召回即注入"模式：模型侧（systemPrompt.append，不可见但影响行为）+ 用户侧（memory:recalled 内联块，可见可解释）。打分为确定性纯逻辑，无 embedding——离线可测、MiniMax 代理可用。

## Data Flow

```
AgentService.start()
  └→ buildSystemPromptAppend({cwd, firstText})
       └→ MemoryInjector.buildAppend()
            ├→ store.list()                     （异常 → ''，AC-6）
            ├→ 过滤: global | project.cwd 前缀匹配  （AC-2）
            ├→ 打分: tagOverlap(firstText)×2 + confidence + recency（AC-3）
            ├→ 截取: 非 skill ≤12 / skill ≤4 / ≤2000 chars
            ├→ 组装 <memory> 段                    （AC-4）
            └→ win.send('memory:recalled', …)      （AC-5，query 启动前）
```

## Contracts

```ts
// src/main/memory/MemoryInjector.ts
export interface MemoryInjectorOptions {
  store: MemoryStore
  win: WebContentsLike
  /** 回调注入 —— AgentService.currentSessionId 的实时读取 */
  currentSessionId: () => string | null
  maxEntries?: number      // 默认 12（非 skill）
  maxSkills?: number       // 默认 4
  maxChars?: number        // 默认 2000
}

export class MemoryInjector {
  async buildAppend(ctx: { cwd: string; firstText: string }): Promise<string>
}
```

事件契约（`src/shared/ipc.ts` EventChannels 新增）：

```ts
'memory:recalled': (p: MemoryRecalledEvent) => void
// MemoryRecalledEvent 定义于 src/shared/types.ts（memory-core 已落位）
```

组装模板：

```
<memory>
Durable memories distilled from previous sessions with this user/project.
Background context only — may be stale; trust current observations over these.
## Preferences
- <content>
## Facts
- <content>
## Lessons
- <content>
## Skills
- When <tag1, tag2>: <content>
</memory>
```

分区任一为空则整个分区省略。

## Edge Cases

- sessionId 尚未捕获（新会话第一条）→ 事件 sessionId 为 ''（与 agent:message 约定一致）；渲染层不依赖 sessionId 匹配。
- 同一条目既在 top-N 又超字符预算 → 逐条累加，超预算即停止（保证截断确定性：按分数序累加）。
- firstText 为空串 → tag 重叠恒 0，退化为 confidence+recency 排序。
- 事件发送在 append 返回**之前**完成，保证渲染层时序：提问 → 召回块 → 回答。

## Alternatives Considered

- **每轮 send 重新注入**：破坏会话内 prompt 稳定性，且与 SDK 流式输入模式冲突。仅回合启动注入。否决。
- **首条 user 消息前缀注入**：污染用户可见消息。否决。
- **依赖 SDK auto-memory（服务端召回）**：MiniMax 代理下不可用；自建路径为主。否决（SDK 路径由 memory-rendering 独立渲染，双轨并存）。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | tests/main/memory/MemoryInjector.test.ts | 空库 → '' 且 sent 无 memory:recalled |
| AC-2 | 同上 | global 入选；project 同 cwd / 父目录入选；无关 cwd 排除 |
| AC-3 | 同上 | tag 重叠打分排序；条目/skill/字符三个上限 |
| AC-4 | 同上 | 模板分区与 skill 行格式；空分区省略 |
| AC-5 | 同上 | 事件载荷（含 sessionId='' 回退与 currentSessionId() 命中） |
| AC-6 | 同上 | store.list reject → '' 不抛 |
| 接线 | src/main/index.ts | injector.buildAppend 作为 buildSystemPromptAppend（memory-rendering spec 的 e2e 覆盖） |
