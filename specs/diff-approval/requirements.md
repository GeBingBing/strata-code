# Requirements: diff-approval

## Overview

diff 预览与批准：当 agent 调用 `Edit` / `Write` / `MultiEdit` / `NotebookEdit` 等会修改文件系统的工具时，在权限批准对话框内嵌入 unified diff 预览，让用户在允许执行前清楚看到将要发生的变更。本功能复用 `permission-approval` 的桥接链路，只扩展渲染层的展示与决策体验。

## Stakeholders

- **用户**: 需要在批准文件修改前，以熟悉的 +/- diff 形式查看变更内容、文件名与位置。
- **开发者**: diff 生成必须是纯函数、可单测；UI 不得阻塞 `PermissionBridge` 的防悬挂保证。

## Assumptions

- `permission-approval` 已经提供 `canUseTool` 桥接、`permission:request/respond` 通道与 `PermissionDialog` 模态框。
- `diff` 库（`createTwoFilesPatch`）可用于生成 unified diff 文本。
- 只有明确会改文件内容的工具才需要 diff 预览；`Read` / `Bash` 等工具不生成 diff。

## Acceptance Criteria (EARS)

- AC-1: WHEN SDK 通过 `canUseTool` 触发 `Edit` / `Write` / `MultiEdit` / `NotebookEdit`, THE SYSTEM SHALL 调用 `diffFromToolInput(toolName, input)` 生成 `{filePath, patch}` 并在 `PermissionDialog` 中嵌入 diff 预览。
- AC-2: WHEN diff 预览渲染, THE SYSTEM SHALL 以 `+` 绿色 / `-` 红色 / `@@` 灰色区分 patch 行。
- AC-3: IF 工具入参不包含可 diff 内容或工具不属于编辑类, THE SYSTEM SHALL 不显示 diff 预览区域。
- AC-4: WHEN 用户在 diff 预览对话框点击"允许", THE SYSTEM SHALL 以 `allow` 解决该 `canUseTool` Promise，让 SDK 继续执行工具调用。
- AC-5: WHEN 用户在 diff 预览对话框点击"拒绝", THE SYSTEM SHALL 以 `deny` 解决该 `canUseTool` Promise。
- AC-6: WHEN 用户点击"总是允许", THE SYSTEM SHALL 透传 `updatedPermissions`（同 `permission-approval` AC-6）并使本会话内同类调用不再弹窗。

## Out of Scope

- 批量 diff 批准（同一回合多个 Edit/Write 的"全部允许"/"全部拒绝"）—— 当前仍逐条弹窗。
- diff 的语法高亮（代码着色）、行号、side-by-side 视图。
- 文件系统实际写入后的再次 diff 对比。
- 跨会话持久化的权限规则（MVP 仅会话级 always-allow）。
