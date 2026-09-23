# Requirements: editor-save-consistency

## Overview

修复编辑器保存链路的数据丢失缺陷：Monaco 输入只写入 `EditorArea` 本地态，`editorStore.tabs[i].content` 从不更新，导致命令面板 `editor.save` 写入过期内容、`dirty` 标记永远不生效、所有依赖脏文件的确认逻辑（切换工作区/关闭工作区）全部失效。

## Stakeholders

- **用户**: 命令面板保存与 Cmd+S 行为一致；脏文件状态实时可见。
- **开发者**: `editorStore` 是编辑器内容的单一事实源；外部重载（文件监听）有受控的同步通道。

## Assumptions

- `@monaco-editor/react` 的受控 `value` 流保持现状（本地 `editorContent` 驱动 Monaco，避免每按键全组件重渲染）。
- 文件监听（`file-watcher` spec）后续会通过外部通道更新 `editorStore`，本 spec 只负责守卫同步逻辑。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户在编辑器中输入, THE SYSTEM SHALL 同步更新 `editorStore.tabs[i].content` 并将该 tab 标记为 dirty。
- AC-2: WHEN 用户通过命令面板触发 `editor.save`, THE SYSTEM SHALL 用 `editorStore` 中的最新内容调用 `file:write`，不得写入过期内容。
- AC-3: WHEN `file:write` 失败, THE SYSTEM SHALL 保留 dirty 标记，不得调用 `markSaved`。
- AC-4: WHEN 切换 tab, THE SYSTEM SHALL 用目标 tab 的内容重置编辑器；不重置 dirty 状态。
- AC-5: WHEN `editorStore` 内容因外部通道（非用户输入）变化且与编辑器当前内容不同, THE SYSTEM SHALL 同步编辑器内容；若相同则不打扰正在进行的输入。
- AC-6: WHEN `StatusBar` 切换工作目录确认流程运行, THE SYSTEM SHALL 不执行任何无效果的占位代码（删除 `void Promise.resolve()` 死代码）。

## Out of Scope

- 文件监听本身（`file-watcher` spec）。
- 多光标/多编辑器分栏。
