# Requirements: sidebar-registry

## Overview

把 ActivityBar 从硬编码的两个面板（Files / Sessions）改为可注册的面板切换器，新增 Search、Memory、Git 三个面板，使侧边栏能力对齐 Cursor / VSCode。

## Stakeholders

- **用户**: 在 ActivityBar 切换 Files / Sessions / Search / Memory / Git 等面板；面板状态在切换时保留。
- **开发者**: 新增面板只需注册一条记录，无需修改 AppShell 或 ActivityBar 的代码。

## Assumptions

- `app-shell` 已提供 ActivityBar + 可折叠 sidebar 布局。
- `memory-core/injection/distillation/rendering` 已完成；memory IPC 已存在（`memory:list/delete`）。
- `workspace-management` 已完成；面板可按当前工作区 cwd 过滤内容。

## Acceptance Criteria (EARS)

- AC-1: WHEN 应用启动, THE SYSTEM SHALL 注册 Files / Sessions / Search / Memory / Git 五个内置面板。
- AC-2: WHEN 用户点击 ActivityBar 上的面板图标, THE SYSTEM SHALL 在 sidebar 中渲染对应面板组件。
- AC-3: WHEN 用户在同一面板多次切换, THE SYSTEM SHALL 保留面板内部状态（如搜索框文本、滚动位置）。
- AC-4: WHEN 用户在工作区标签栏切换工作区, THE SYSTEM SHALL 让当前面板按需重新加载工作区相关内容。
- AC-5: WHEN 用户在 Search 面板输入查询并按 Enter, THE SYSTEM SHALL 在当前工作区执行文件内容搜索并展示结果。
- AC-6: WHEN 用户在 Git 面板打开, THE SYSTEM SHALL 显示当前工作区的 git 状态、变更文件列表与最近 N 条 commit。
- AC-7: WHEN 用户在 Memory 面板打开, THE SYSTEM SHALL 显示全局与项目记忆列表，并允许删除条目。

## Out of Scope

- 自定义第三方面板（插件机制，留给后续 spec）。
- 拖拽排序 ActivityBar 图标。
- 多选搜索结果（一次只打开一个）。
- Git 提交/推送操作（仅查看状态与 diff）。
