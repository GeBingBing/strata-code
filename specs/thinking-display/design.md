# Design: thinking-display

## Context

实现 [requirements.md](./requirements.md)。thinking 块是 SDK assistant 消息 content 数组中的一种 block 类型。当前 `applySdkMessage` 已读取该字段，UI 需要增加对应的渲染组件。

## Data Flow / Architecture

```
SDK assistant message
    │
    ▼
applySdkMessage → UiItem（assistant）包含 thinking?: string
    │
    ▼
MessageItem 渲染
    ├─ thinking > 0 ? <ThinkingBlock text={thinking} /> : null
    └─ 正式 text / tool_use 渲染
```

## Contracts

```ts
// src/renderer/src/lib/applySdkMessage.ts
interface AssistantUiItem {
  kind: 'assistant'
  id: string
  text: string
  thinking?: string
  // ...
}

// src/renderer/src/components/chat/ThinkingBlock.tsx
export function ThinkingBlock({ text }: { text: string }): React.JSX.Element

// data-testid
'thinking-block'
'thinking-summary'
```

## Edge Cases

- 流式增量中 thinking 先出现、text 后出现 → partial 更新应分别累积。
- thinking 很长 → 区域内部可滚动。
- 只有 thinking 没有 text → 显示 thinking 区域，正式回复为空。

## Alternatives Considered

- **把 thinking 直接拼接在 text 前面**：会混淆推理过程与正式回复，用户体验差。
- **用独立消息条目显示 thinking**：破坏 SDK 消息结构；thinking 是 assistant 消息的一部分。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/4 | `src/renderer/src/lib/applySdkMessage.test.ts` | thinking block 被解析进 UiItem |
| AC-2/3/5 | `src/renderer/src/components/chat/ThinkingBlock.test.tsx` | 折叠/展开/空文本行为 |
| AC-1/4 | `src/renderer/src/components/chat/MessageItem.test.tsx` | assistant 消息同时渲染 thinking 与 text |
