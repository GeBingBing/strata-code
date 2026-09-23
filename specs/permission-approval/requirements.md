# Requirements: permission-approval

## Overview

权限批准链路：把 SDK 的 `canUseTool` 回调桥接为渲染进程的批准对话框。这是应用安全模型的核心 — 用户对 agent 的每个敏感操作（Bash/Edit/Write 等）拥有最终决定权。技术难点：`canUseTool` 是主进程中的异步回调，其 Promise 决议必须跨越 IPC 边界，且**任何情况下不得悬挂**（悬挂 = agent 回合静默冻结）。

## Stakeholders

- **用户**: 需要清晰看到将要执行的操作（工具名、参数、触发原因），并能允许/拒绝/总是允许。
- **开发者**: 防悬挂保证是硬性要求；PermissionBridge 是 AgentService 的 canUseTool 实现来源。

## Assumptions

- SDK `canUseTool(toolName, input, {signal, suggestions, blockedPath, decisionReason})` 返回 `PermissionResult`（`{behavior: 'allow'|'deny', updatedInput?, updatedPermissions?}`）。
- 回调可能并发多次（agent 并行调用多个工具），必须用请求 id 关联。
- 渲染进程可能被关闭/reload — 主进程不能依赖渲染端一定会回应。

## Acceptance Criteria (EARS)

- AC-1: WHEN SDK 调用 canUseTool, THE SYSTEM SHALL 以唯一 id 经 `permission:request` 向渲染进程发送 {id, toolName, input, suggestions?, blockedPath?, decisionReason?}。
- AC-2: WHEN 渲染进程以 `{id, decision}` 回应 `permission:respond`, THE SYSTEM SHALL 用该 decision 解决对应的 canUseTool Promise。
- AC-3: IF 工具调用的 AbortSignal 被触发, THE SYSTEM SHALL 将该请求（且仅该请求）以 `{behavior:'deny'}` 解决并移出待定表。
- AC-4: IF 渲染进程目标（webContents）被销毁, THE SYSTEM SHALL 将全部待定请求以 `{behavior:'deny'}` 解决。
- AC-5: IF 收到未知 id 或已解决 id 的 respond, THE SYSTEM SHALL 幂等地忽略（不抛异常、不影响其他待定请求）。
- AC-6: WHEN 用户在对话框选择"总是允许", THE SYSTEM SHALL 返回 `updatedPermissions`（透传 SDK 的 suggestions）使本会话内同类调用不再打扰用户。
- AC-7: WHEN 渲染进程收到 permission:request, THE SYSTEM SHALL 显示模态对话框呈现工具名、参数摘要与决策按钮（允许/总是允许/拒绝）。

## Out of Scope

- 权限模式切换 UI（agent-service 已提供 setPermissionMode 通道；模式选择器属 app-config spec）。
- 跨会话持久化的权限规则（MVP 仅会话级 always-allow）。
