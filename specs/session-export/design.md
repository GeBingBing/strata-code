# Design: session-export

## Context

实现 [requirements.md](./requirements.md)。导出功能以渲染层为主导：读取 `chatStore.items` 或调用 `sessions:read`，格式化后通过 Electron 剪贴板/对话框 API 落地。

## Data Flow / Architecture

```
用户点击消息"复制"
    │
    ▼
MessageItem 调用 navigator.clipboard.writeText(text)
    │
用户选择"导出会话"
    │
    ▼
SessionSidebar / ChatView 调用 invoke('session:export', { id, format })
    │
    ▼
Main: 读取转录 → 格式化 → dialog.showSaveDialog → fs.writeFile
```

## Contracts

```ts
// src/shared/ipc.ts（新增）
'session:export': (p: { id: string; format: 'markdown' | 'json' }) => Promise<void>

// data-testid
'message-copy'      // 单条消息复制按钮
'session-export-md' // 导出 Markdown 按钮
'session-export-json' // 导出 JSON 按钮
```

## Edge Cases

- 空会话导出 → 生成只含提示语的文件（如"# New session\n\n（无消息）"）。
- 工具调用结果很长 → Markdown 中截断展示，JSON 保留完整。
- 文件名冲突 → 由系统保存对话框处理。

## Alternatives Considered

- **纯渲染层导出（不经过主进程）**：无法直接写文件；主进程导出更安全，也便于未来加权限控制。
- **导出时包含完整 SDK 内部事件（partial/stream_event）**：对普通用户噪音过大；默认只导出 final 消息。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `src/renderer/src/components/chat/MessageItem.test.tsx` | 复制按钮调用 clipboard.writeText |
| AC-2/4 | `tests/main/sessions/SessionStore.test.ts` 或新增 `session-export.test.ts` | Markdown 格式化包含消息与工具摘要 |
| AC-3 | 同上 | JSON 导出包含完整消息列表 |
| AC-5 | 同上 | 取消保存对话框不抛异常 |
