# Requirements: workspace-management

## Overview

把工作区从「全局 cwd 字符串 + localStorage 最近列表」提升为一级持久化对象：支持同时打开多个文件夹、每个工作区拥有独立的最近会话与编辑器标签状态、通过顶部标签栏切换。

## Stakeholders

- **用户**: 可以同时打开多个项目/文件夹；切换项目时自动恢复该项目上次活跃的会话和打开的文件；关闭工作区不影响其他已打开的工作区。
- **开发者**: `WorkspaceStore` 是主进程持久化真相源；渲染层 `workspaceStore` 管理 UI 状态；`configStore` 的 `recentWorkspaces` 降级为只读迁移来源。

## Assumptions

- `workspace-foundation` 已完成：WelcomePage、FileService.setRoot、SettingsModal、session cwd 恢复、`workspace:changed` 事件。
- `session-history` 与 `editorStore` 已存在。
- 单窗口 MVP：多工作区在同一个窗口内通过标签切换；多窗口留给后续 spec。

## Acceptance Criteria (EARS)

- AC-1: WHEN 用户选择一个新文件夹作为工作区, THE SYSTEM SHALL 创建或复用一个 `Workspace` 记录，并将其加入已打开工作区列表。
- AC-2: WHEN 用户点击顶部工作区标签, THE SYSTEM SHALL 切换当前活跃工作区，并恢复该工作区的 `cwd`、活跃会话与打开的文件标签。
- AC-3: WHEN 用户关闭某个工作区标签, THE SYSTEM SHALL 从已打开列表移除该工作区，并切换到最近使用的剩余工作区；若已无工作区，则显示 WelcomePage。
- AC-4: WHEN 活跃工作区变化, THE SYSTEM SHALL 保存上一个工作区的视图状态（activeSessionId、openFilePaths、sidebarTab、chatInputDraft）。
- AC-5: WHEN 应用启动时存在已持久化的打开工作区, THE SYSTEM SHALL 恢复这些工作区，并激活上次关闭前活跃的工作区。
- AC-6: WHEN SessionSidebar 显示会话列表, THE SYSTEM SHALL 只显示与当前活跃工作区 `cwd` 匹配的会话。
- AC-7: IF 用户尝试关闭唯一一个工作区且存在未保存文件, THE SYSTEM SHALL 提示用户确认，避免数据丢失。

## Out of Scope

- 多窗口 / 多进程工作区（后续 spec）。
- 工作区重命名、自定义颜色/图标（后续 spec）。
- 工作区级的设置隔离（如每个工作区不同的模型默认值）。
- 拖拽排序工作区标签。
