# Design: file-context-mentions

## Context

实现 [requirements.md](./requirements.md)。当前 Composer 只能发送纯文本；Agent 通过 SDK 自行发现 cwd 中的文件。本设计让用户能通过 `@` 显式把文件/文件夹加入当前消息的上下文。

## Data Flow / Architecture

```
Composer 输入:
  用户输入 "@"
    │
    ▼
  MentionPicker 弹出（基于 file:list 的模糊文件树）
    │
    ▼
  选中 file/folder → 生成 MentionAttachment
    │
    ▼
  Composer 渲染 chips + 纯文本输入框
    │
    ▼
  点击发送
    │
    ▼
  chatStore.send(text, attachments)
    - UI 立即追加 UiItem { kind: 'user', text, attachments }
    │
    ▼
  invoke('agent:send', { text, attachments })
    │
    ▼
  Main handler 调用 contextAssembler.assemble(text, attachments)
    - file:read 每个文件
    - 大文件/二进制 → 只保留路径 + size + 说明
    │
    ▼
  组装后的完整 prompt 传给 AgentService.send
```

## Contracts

```ts
// src/shared/types.ts
export interface MentionAttachment {
  type: 'file' | 'folder' | 'range'
  id: string           // `${type}:${path}[:start-end]`
  path: string
  label: string        // 显示名称
  range?: { startLine: number; endLine: number }
}

// src/shared/ipc.ts
'agent:send': (p: { sessionId?: string; text: string; attachments?: MentionAttachment[] }) => Promise<void>

// src/renderer/src/lib/applySdkMessage.ts
UiItem =
  | { kind: 'user'; id: string; text: string; attachments?: MentionAttachment[] }
  | ...

// src/renderer/src/lib/contextAssembler.ts
export async function assembleContext(
  text: string,
  attachments: MentionAttachment[]
): Promise<string>

// src/main/index.ts agent:send handler
'agent:send': async ({ sessionId, text, attachments }) => {
  activeSessionTitle = titleFromFirstMessage(text)
  const prompt = attachments?.length
    ? await assembleContext(text, attachments)
    : text
  await agentService!.send(prompt, sessionId ? { resume: sessionId } : undefined)
}
```

## Edge Cases

- 输入框为空但只发送 attachments → 允许，text 可为空字符串。
- 同一文件多次附加 → 去重，保留第一次。
- 文件夹附件 → 递归列出目录下文件，跳过二进制/过大文件（只保留元数据）。
- 文件在发送前被删除 → 读取失败时保留路径并标注 "(无法读取)"。
- `@` 出现在字符串中间（如 `look @file`）→ 只触发选择器；chip 插入到当前 caret 位置。

## Alternatives Considered

- **在渲染层读取文件并拼接 prompt**：违反最小权限，且让测试依赖 IPC。
- **把 attachments 作为独立 UiItem kind**：`user` 与附件语义上属于同一条消息，合并更自然。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `src/renderer/src/components/chat/MentionPicker.test.tsx` | `@` 触发、键盘导航、选中回调 |
| AC-3 | `src/renderer/src/lib/applySdkMessage.test.ts` | 带 attachments 的 user item 被保留 |
| AC-3 | `src/renderer/src/components/chat/MessageItem.test.tsx` | 渲染 attachment chips |
| AC-4 | `tests/main/contextAssembler.test.ts` | 文件内容拼接、文件夹展开、大文件元数据 |
| AC-5 | `src/renderer/src/lib/sessionExport.test.ts` | Markdown/JSON 包含 attachments |
| AC-6 | `tests/main/contextAssembler.test.ts` | 大文件只保留元数据 |
