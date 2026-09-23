# Design: session-search-and-grouping

## Context

实现 [requirements.md](./requirements.md)。本功能在 `SessionSidebar` 组件内完成，完全在渲染层，不新增 IPC 通道，也不修改 `sessionStore` 的数据结构。

## Data Flow / Architecture

```
sessionStore.sessions
    │
    ▼
SessionSidebar query state
    │
    ├─ filter(sessions, query)
    │
    ▼
groupByDate(filtered)
    │
    ▼
渲染为分组列表
```

## Contracts

```ts
// src/renderer/src/components/sessions/SessionSidebar.tsx
function groupByDate(sessions: SessionSummary[]): {
  today: SessionSummary[]
  yesterday: SessionSummary[]
  earlier: SessionSummary[]
}

// data-testid
'session-search'
'group-今天'
'group-昨天'
'group-更早'
```

## Edge Cases

- 搜索框为空 → 显示全部分组。
- 无会话 → 显示「无匹配会话」（也覆盖空列表初始状态）。
- 跨天时间边界 → 以本地日期零点划分。
- 搜索时 active 会话被过滤掉 → active 高亮不再显示，但状态不变；清空搜索后恢复。

## Alternatives Considered

- **在 sessionStore 中加 filteredSessions**：会让 store 承担 UI 状态，本功能更适合组件本地 state。
- **按 cwd 分组**：需要 UI 切换，MVP 后迭代。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2/3 | `src/renderer/src/components/sessions/SessionSidebar.test.tsx` | 搜索框存在、输入后过滤、无结果提示 |
| AC-4/5 | 同上 | 今天/昨天/更早分组正确显示，空分组隐藏 |
| AC-6 | 同上 / `tests/e2e/sessions.spec.ts` | 点击过滤后的会话可打开 |
