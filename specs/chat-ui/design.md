# Design: chat-ui

## Context

实现 [requirements.md](./requirements.md)。状态管理用 **zustand**（可用在 React 外、selector 精确重渲染、样板少）。`applySdkMessage` 是纯函数 `(state, message) => state`。

## Data Flow / Architecture

```
IPC agent:message ──► ipc/client.on(cb) ──► applySdkMessage(state, msg) ──► zustand store
                                                                    │
UI: MessageList ◄─ selector ─────────────────────────────────────────┘
    Composer ── agent:send / agent:interrupt
    ToolCallCard（组件树内，数据来自 store 的 toolCall 条目）
```

## Contracts

```ts
// UI 状态（zustand chatStore）
type ChatState = {
  status: AgentStatus                    // 'idle' | 'running' | 'error'
  items: UiItem[]                        // 有序：消息气泡与工具卡片混合
  streamingId: string | null             // 当前流式气泡的消息 id
  costUsd?: number; durationMs?: number
  error?: string
}
type UiItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean }
  | { kind: 'tool'; id: string; toolName: string; input: unknown;
      status: 'running' | 'success' | 'error'; output?: string }
  | { kind: 'error'; id: string; text: string }

applySdkMessage(state: ChatState, msg: SDKMessage): ChatState
```

## Edge Cases

- partial 在没有任何先前 partial 时到达 → 新建流式气泡。
- tool_result 无匹配 tool_use（如 resume 历史回放）→ 忽略。
- 同一 partial 重复到达 → 幂等（以 message.id + 已累积内容判断）。
- 用户消息乐观渲染 vs SDKUserMessage 回放 → 以消息 id 去重。

## Alternatives Considered

- **Redux Toolkit**: 更重；无 async 之外的收益。
- **组件内 useEffect 折叠**: 逻辑无法脱离 React 单测 — 违背 reducer 可测性目标。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `src/renderer/src/lib/applySdkMessage.test.ts` | partial 累积、final 替换去重 |
| AC-3/4 | 同上 | tool_use 创建、tool_result 完成态 |
| AC-5/8 | 同上 | result→idle+cost；error 条目 |
| AC-6/7 | `components/chat/Composer.test.tsx` | 提交→agent:send+乐观气泡；运行中停止→interrupt |
| 全部 | `components/chat/ChatView.test.tsx` | 渲染冒烟（mock ipc） |
