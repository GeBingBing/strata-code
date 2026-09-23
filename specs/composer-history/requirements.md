# Requirements: composer-history

## Overview

Composer 提供 shell-style 上箭头历史导航与工作区级草稿持久化。无新 IPC。

## Stakeholders

- **用户**: 不丢手输一半的提示词；方向键可回看/前向已发送消息。
- **开发者**: chatStore 维护 history 环形缓冲；workspaceStore.chatInputDraft 已存在，Composer 接通。

## Assumptions

- `workspaceStore.collectViewState` 已有 `chatInputDraft` 字段（占位 `undefined`）。
- Composer 文本事实源在 `Composer` 内部 useState；本 spec 把事实源迁到 chatStore。
- 历史范围：当前会话级（reset/newChat 清空），环形 50 条。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户发送消息, THE SYSTEM SHALL 把消息文本（去连续重复）追加到 `chatStore.history`。
- AC-2: WHEN Composer 文本非空且光标在 start（selectionStart===0 && selectionEnd===0）且 mention picker 关闭, ArrowUp 进入历史导航模式并展示上一条历史。
- AC-3: WHEN 处于历史模式且未越过最新条目, ArrowDown 回到更近的条目；越过最新时恢复用户原本的草稿。
- AC-4: WHEN 用户在历史模式下输入任意字符, THE SYSTEM SHALL 退出历史模式并把字符追加到当前条目。
- AC-5: WHEN Composer 文本变化（输入、删空、mention 选择）, THE SYSTEM SHALL 以 500ms 防抖写入 `workspaceStore.updateState({chatInputDraft})`。
- AC-6: WHEN 切换工作区, THE SYSTEM SHALL 恢复目标工作区上次的草稿。
- AC-7: WHEN `reset/newChat`, THE SYSTEM SHALL 清空 `composerDraft` 与 `history`。

## Out of Scope

- 跨会话历史（仅当前会话）。
- 草稿冲突合并（最后写入获胜）。
