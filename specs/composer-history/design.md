# Design: composer-history

## Context

实现 [requirements.md](./requirements.md)。

## Data Model

`chatStore` 新增：
- `composerDraft: string` —— Composer 文本事实源。
- `history: string[]` —— 环形 50，去连续重复。
- `historyCursor: number | null` —— null 表示未在历史模式；否则为索引。
- `preHistoryDraft: string` —— 进入历史模式前暂存的当前草稿。

`workspaceStore.collectViewState` 中 `chatInputDraft` 接 `composerDraft`；`restoreViewState` 回写。

## Composer 行为

- 文本输入 → `useChatStore.setState({ composerDraft: v })`。
- 500ms 防抖 → `workspaceStore.updateState({ chatInputDraft })`。
- ArrowUp：`if (composerDraft !== '' && historyCursor === null)` 暂存 preHistoryDraft，设置 cursor = history.length - 1，显示历史[history.length-1]；否则 cursor > 0 时 cursor--。
- ArrowDown：cursor < history.length - 1 时 cursor++，显示新条目；cursor === history.length - 1 时回到 preHistoryDraft 并清 cursor。
- 任何输入退出历史模式。
- submit 时 push 到 history（去连续重复），清 composerDraft/historyCursor/preHistoryDraft。
- reset/newChat 清全部。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/7 | `chatStore.test.ts` | send 推入 history（去重）；reset 清空 |
| AC-2/3/4 | `Composer.test.tsx` | 模拟 ArrowUp/Down/输入验证 cursor 状态机 |
| AC-5/6 | `workspaceStore.test.ts` | collectViewState 含 draft；restoreViewState 回写 |
