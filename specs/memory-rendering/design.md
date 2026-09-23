# Design: memory-rendering

## Context

[requirements.md](./requirements.md) — 双路径召回收敛到单一 UiItem kind；渲染逻辑全部在 `applySdkMessage` 纯 reducer（项目约定：UI 逻辑改动先改它的测试）。

## Data Flow

```
agent:message(SDK memory_recall) ──→ applySdkMessage case 'system' subtype 分发
                                          ├→ UiItem {kind:'memory', source:'sdk', id:uuid}
memory:recalled 事件 ──→ applyMemoryRecalled ──→ UiItem {kind:'memory', source:'app', id 按内容去重}
agent:message(SDK compact_boundary) ──→ applySdkMessage ──→ UiItem {kind:'compact'}
memory:distilled 事件 ──→ chatStore ──→ ChatState.lastDistill ──→ StatusBar 徽标
```

## Contracts

```ts
// applySdkMessage.ts —— UiItem 新增
| { kind: 'memory'; id: string; source: 'app' | 'sdk'; entries: { kind: MemoryKind; content: string }[] }
| { kind: 'compact'; id: string; trigger: 'manual' | 'auto'; preTokens: number; postTokens?: number }

// 新导出 reducer
export function applyMemoryRecalled(state: ChatState, event: MemoryRecalledEvent): ChatState

// ChatState 新增
lastDistill?: { added: number; updatedAt: number }

// 新组件 src/renderer/src/components/chat/MemoryRecallBlock.tsx
// data-testid="memory-recall" data-source={source}，条目行带 kind 标签
```

组件挂载点：
- `MessageItem.tsx` 增加 `case 'memory'` → `<MemoryRecallBlock>`、`case 'compact'` → 分隔线。
- `AssistantTurn.tsx` 的 AssistantItem 联合类型必须扩展（当前会静默丢弃未知 kind——不加进去永远不渲染）。

## Edge Cases

- SDK memory_recall 的 memories[].content 可能缺失（select 模式文件型条目）→ 显示 path basename。
- 回放去重：sdk 路径按 uuid；app 路径按 memory id（同一批条目重复注入只显示一次）。
- compact_boundary 的 preTokens/postTokens 缺失 → 显示无数字的通用文案。
- sessionExport：memory → markdown 引用块 / JSON 结构化；compact → `--- [context compacted] ---`。

## Alternatives Considered

- **召回块放 system 气泡**：与 error 条目复用样式——语义混淆。独立 kind。否决。
- **Toast 通知蒸馏完成**：瞬态不可回溯；状态栏徽标持久可见。否决。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | src/renderer/src/lib/applySdkMessage.test.ts | memory_recall → memory item；uuid 去重；content 缺失 basename |
| AC-2 | 同上 | applyMemoryRecalled 追加 + memory id 去重 |
| AC-4 | 同上 | compact_boundary → compact item |
| AC-3 | src/renderer/src/components/chat/MemoryRecallBlock.test.tsx | 标头/条目/testid/data-source |
| AC-3 | src/renderer/src/components/chat/MessageItem.test.tsx | 新 kind 渲染路径 |
| AC-5 | src/renderer/src/components/chat/StatusBar.test.tsx | 记忆 +N 徽标 |
| AC-6 | src/renderer/src/lib/sessionExport.test.ts | 新 kind 导出格式 |
| AC-7 | tests/e2e/memory.spec.ts | 全链路 fake 模式 |
