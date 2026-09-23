# Design: inline-chat

## Context

实现 [requirements.md](./requirements.md)。

## Data Flow

1. `EditorArea.handleMount`: `ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyK, () => setInlineChatAnchor(...))`。
2. 读取 `ed.getSelection()` + `getModel().uri`/active tab path → 状态 `{ anchor: {x,y}, range: {s,e}, path, basename }`。
3. 渲染 `<InlineChat>` 在 `.editor-host` 内的绝对定位浮层。
4. 提交：`useChatStore.getState().send(text, [attachment])`，其中 `attachment.id = range-${path}-${s}-${e}-${ts}` 唯一。

## IPC / Contracts

零新 IPC。复用：
- `MentionAttachment`（`type:'range'`，`range:{startLine,endLine}`）
- `contextAssembler.assembleContext` 已有 range 处理
- `chatStore.send(text, attachments?)`

## Edge Cases

- 二进制/超大 tab：ed.addCommand 不注册（仅在 `onMount` 时挂载，handleMount 不在 placeholder 路径触发）。
- chat 面板折叠：send 不依赖面板可见性。
- 选中跨越折叠区域：lineNumber 来自 model（正确）。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/3 | `EditorArea.test.tsx`（新增） | mock Monaco addCommand 捕获 Cmd+K 回调；调用时 setInlineChat 状态 |
| AC-2/4 | `InlineChat.test.tsx`（新增） | submit 构造正确 attachment 并调 send；Esc 关闭 |
| AC-5 | jsdom | 浮层 data-testid 出现并定位 |
