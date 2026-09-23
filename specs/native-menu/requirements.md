# Requirements: native-menu

## Overview

原生菜单：为 macOS 应用注册标准菜单栏（File / Edit / View / Help），让用户能通过键盘快捷键与菜单项触发常用操作（新对话、复制、粘贴、设置等）。本功能补齐 Electron 桌面应用的基础平台体验。

## Stakeholders

- **用户**: 需要 Cmd+N 新对话、Cmd+W 关闭窗口、Cmd+, 打开设置等标准快捷键。
- **开发者**: 菜单项应复用现有 IPC / store action，不引入独立业务逻辑。

## Assumptions

- Electron 的 `Menu.setApplicationMenu` 可用于注册应用级菜单。
- `sessionStore.newChat`、`workspace:pick`、`agent:send` 等 IPC/action 已存在。
- 当前应用未注册任何菜单（`main/index.ts` 无 Menu 调用）。

## Acceptance Criteria (EARS)

- AC-1: WHEN 应用启动, THE SYSTEM SHALL 注册标准应用菜单（至少包含 File / Edit / View / Help）。
- AC-2: WHEN 用户选择 File → New Chat 或按 Cmd+Shift+N, THE SYSTEM SHALL 触发新对话（同 sidebar "新对话" 按钮）。
- AC-3: WHEN 用户选择 File → Open Workspace 或按 Cmd+Shift+O, THE SYSTEM SHALL 触发 `workspace:pick`。
- AC-4: WHEN 用户选择 Edit → Copy / Paste, THE SYSTEM SHALL 使用系统默认剪贴板行为。
- AC-5: WHEN 用户选择 View → Reload 或按 Cmd+R, THE SYSTEM SHALL 重新加载当前窗口。
- AC-6: WHEN 用户选择 File → Settings 或按 Cmd+Comma, THE SYSTEM SHALL 打开设置面板（或 placeholder 提示）。

## Out of Scope

- Windows / Linux 菜单差异细节（当前以 macOS 为主）。
- 上下文菜单（右键菜单）—— 留给后续 spec。
- 菜单项的国际化与动态启用/禁用状态（MVP 后迭代）。
