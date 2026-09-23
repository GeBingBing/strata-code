# Design: error-recovery

## Context

实现 [requirements.md](./requirements.md)。错误恢复在现有 `chatStore` 上增加两种用户动作：重试（retry last user message）与重新生成（regenerate assistant message）。两者都通过启动新会话来避免污染历史上下文。

## Data Flow / Architecture

```
agent:error 到达
    │
    ▼
chatStore.applyAgentError → items 追加 error 条目；status = 'error'
    │
    ▼
Composer 检测到 status === 'error'
    ├─ 显示"重试"按钮
    └─ 点击 → chatStore.retry()
            │
            ▼
    取最后一条 user item 的 text
            │
            ▼
    sessionStore.newChat() → activeId = null
            │
            ▼
    invoke('agent:send', { text })（乐观 UI 同 AC-7）

MessageItem（assistant）hover/菜单
    │
    ▼
"重新生成"按钮 → chatStore.regenerate(messageId)
            │
            ▼
    截取该 assistant 消息之前的所有 items 作为上下文
            │
            ▼
    新建会话 → 用截取的上下文调用 openSession() → send 空/同义 prompt
            │
            ▼
    新回复追加到列表末尾
```

## Contracts

```ts
// src/renderer/src/state/chatStore.ts
interface ChatActions {
  // ... existing
  retry: () => Promise<void>
  regenerate: (messageId: string) => Promise<void>
}

// data-testid
'retry-button': 重试按钮
'regenerate-button': 重新生成按钮
```

## Edge Cases

- 最后一条消息不是 user（例如错误发生在 assistant 生成中）→ "重试"按钮仍发送最后一条 user 消息；若无 user 消息则禁用。
- 重新生成时原 assistant 消息被删除 → 用删除前的上下文快照。
- 运行中点击重试 → 先中断当前查询，再发送。
- 连续多次重新生成 → 每次都在列表末尾追加新 assistant 条目，形成多条候选回复。

## Alternatives Considered

- **原地重试不切换 session**：会导致 SDK 上下文混乱（resume 语义不明确），故采用新会话。
- **自动重试 3 次**：虽简单，但会隐藏网络问题并可能产生意外成本；MVP 手动触发更可控。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `src/renderer/src/components/chat/Composer.test.tsx` | error 状态显示重试按钮；点击后发送最后一条 user 消息 |
| AC-3/4/5 | `src/renderer/src/components/chat/MessageItem.test.tsx` / `ChatView.test.tsx` | assistant 消息显示重新生成；点击后保留历史并追加新回复 |
| AC-6 | `src/renderer/src/state/chatStore.test.tsx` | 再次失败时仍显示 error 条目，不自动重试 |
