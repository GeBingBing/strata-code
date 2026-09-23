# Requirements: inline-chat

## Overview

在编辑器中选中代码后按 Cmd+K，弹出浮层，输入指令后发送给 agent，并把选中范围作为 `range` 附件。零主进程改动（contextAssembler 已支持）。

## Stakeholders

- **用户**: 选中代码 → Cmd+K → 输入 → 发送，无需切换 chat 面板。
- **开发者**: 复用现有 `MentionAttachment.range` 类型、`chatStore.send` 与 `contextAssembler`。

## Assumptions

- `EditorArea` 已持有 Monaco `editor` 实例（`editorRef`）。
- 二进制/超大 tab 时 Monaco 未挂载，不注册 Cmd+K。
- `contextAssembler.ts:57-62` 已支持按 `range.startLine..endLine` 切片。

## Acceptance Criteria (EARS)

- AC-1: WHEN 活动 tab 是文本文件且编辑器获得焦点, 用户按 Cmd+K, THE SYSTEM SHALL 打开 InlineChat 浮层，并预填当前选中范围。
- AC-2: WHEN 浮层打开且有选中区, 用户输入并按 Enter, THE SYSTEM SHALL 以 `MentionAttachment {type:'range', path, label:'file:s-e', range:{s,e}}` 调用 `chatStore.send(text, [attachment])`。
- AC-3: WHEN 无选中, Cmd+K 用当前光标行的单行 range 作为附件。
- AC-4: WHEN 浮层打开, 用户按 Esc 或点击浮层外部, THE SYSTEM SHALL 关闭浮层不发送。
- AC-5: WHEN 浮层打开, THE SYSTEM SHALL 锚定在编辑器中选区附近（视觉对齐，scoped 在 .editor-host 内）。

## Out of Scope

- 视觉选区高亮（编辑器原生 selection 已足够）。
- 选中跨多文件/多光标（仅首个 selection）。
