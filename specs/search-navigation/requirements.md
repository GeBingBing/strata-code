# Requirements: search-navigation

## Overview

把 SearchPanel 的搜索结果从「展示」升级为「点击即跳转」：点击结果在编辑器中打开对应文件并定位到匹配行。无新 IPC。

## Stakeholders

- **用户**: 搜索后能直接定位到匹配行；行为对齐 VSCode 的搜索面板。
- **开发者**: 复用现有的 `editorStore.open` + `file:read` 路径；cursor 是导航意图而非 tab 状态。

## Assumptions

- `editorStore` 单例、`file:read` IPC 已存在。
- `EditorArea` 已持有 Monaco 实例（save 路径）。
- Monaco API：`revealLineInCenter` / `setPosition` / `focus` 均标准可用。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户点击 SearchPanel 的搜索结果, THE SYSTEM SHALL 在编辑器中打开该文件并把光标定位到匹配行。
- AC-2: WHEN 该文件已打开为活动 tab, THE SYSTEM SHALL 仅更新光标位置，不重新打开。
- AC-3: WHEN 匹配行超出当前文件长度（文件被外部缩短）, THE SYSTEM SHALL clamp 到最大行。
- AC-4: WHEN 二进制/超大文件命中搜索结果, THE SYSTEM SHALL 仍打开对应占位 tab（保持当前行为），不报错。

## Out of Scope

- 多选 / 批量打开 / 替换。
- 编辑器内 highlight 当前匹配的高亮。
