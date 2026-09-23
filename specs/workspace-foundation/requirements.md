# Requirements: workspace-foundation

## Overview

补齐当前「工作区」作为全局 cwd 字符串带来的体验缺口，为后续多工作区、文件上下文、扩展侧边栏奠定基础。本 spec 覆盖：空状态欢迎页、工作目录根路径跟随、设置面板、以及打开历史会话时恢复原始 cwd。

## Stakeholders

- **用户**: 启动应用时能看到清晰的起始页；切换工作目录后文件树/读取不再报错；打开历史会话能自动回到当时的项目目录；有真正的设置面板。
- **开发者**: `FileService` 的根路径可随配置变化；`SessionSummary.cwd` 被实际使用；新增 `workspace:changed` 事件作为工作区切换的统一通知。

## Assumptions

- `app-config` 已提供 `config:get` / `config:set` / `workspace:pick` 与 `AgentService.setCwd`。
- `session-history` 已在 `SessionSummary` 中预留 `cwd` 字段。
- `app-shell` 已提供 `WelcomePage` 组件但尚未挂载。
- `native-menu` 已发送 `menu:open-settings` 事件，当前被错误地映射到命令面板。

## Acceptance Criteria (EARS)

- AC-1: WHEN 应用启动且没有设置 cwd, THE SYSTEM SHALL 渲染 `WelcomePage` 而非直接显示空的主界面。
- AC-2: WHEN 用户通过 `WelcomePage` 或 `StatusBar` 切换工作目录, THE SYSTEM SHALL 同步更新 `FileService` 的根路径，使该目录下的文件可被读取。
- AC-3: WHEN 用户切换工作目录, THE SYSTEM SHALL 广播 `workspace:changed` 事件，携带新的 `cwd`。
- AC-4: WHEN 用户触发 `menu:open-settings`（Cmd+,）, THE SYSTEM SHALL 打开真正的设置面板，而非命令面板。
- AC-5: WHEN 设置面板打开, THE SYSTEM SHALL 允许用户修改编辑器主题、字体大小、自动换行、小地图，以及当前模型与权限模式。
- AC-6: WHEN 用户从历史会话列表打开某会话, THE SYSTEM SHALL 先恢复该会话保存的 `cwd`，再加载历史消息。
- AC-7: IF 当前编辑器存在未保存文件且恢复 cwd 会导致离开当前目录, THE SYSTEM SHALL 提示用户确认，避免数据丢失。

## Out of Scope

- 多工作区标签/窗口管理（留给 `workspace-management` spec）。
- 文件上下文 / `@` 提及（留给 `file-context-mentions` spec）。
- 扩展侧边栏面板 Search/Memory/Agents/Git（留给 `sidebar-registry` spec）。
- 配置的磁盘持久化（仍保存在 localStorage / 运行时状态）。
