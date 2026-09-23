# Requirements: app-config

## Overview

应用配置：统一管理当前工作目录（cwd）、权限模式（permissionMode）、模型（model）与运行模式（agentMode）。本功能把 `workspace:pick`、`config:get`、`agent:setPermissionMode` 三条 IPC 的真实语义契约化，并消除 `config:get` 返回值中的硬编码，使状态栏、设置面板与 AgentService 状态保持一致。

## Stakeholders

- **用户**: 需要随时看到 agent 当前工作目录、权限模式与模型；能切换工作目录与权限模式。
- **开发者**: `AppConfig` 是跨 IPC 的共享类型；任何新增配置项必须在此 spec 定义，禁止在主进程 handler 中写死默认值。

## Assumptions

- `app-shell` 已提供类型安全的 IPC 通道注册机制。
- `agent-service` 已提供 `agent:send/interrupt/setPermissionMode` 与 `agent:status/error/message` 事件。
- `session-history` 已在 `SessionSummary` 中预留 `cwd` 字段。
- 模型切换通过 `Options.model` 透传给 SDK；fake 模式下内部固定为 `'fake-model'`。

## Acceptance Criteria (EARS)

- AC-1: WHEN 应用启动, THE SYSTEM SHALL 以用户 home 目录作为默认 cwd 初始化 AgentService，并在 `AppConfig.cwd` 中反映该值。
- AC-2: WHEN 用户触发"选择工作目录", THE SYSTEM SHALL 调用 `dialog.showOpenDialog` 并返回所选目录路径；取消则返回 `null`。
- AC-3: WHEN 用户切换工作目录, THE SYSTEM SHALL 更新 `AppConfig.cwd`，并将后续新查询的 `Options.cwd` 设为新目录。
- AC-4: WHEN 渲染进程调用 `config:get`, THE SYSTEM SHALL 返回当前真实的 `{cwd, permissionMode, model, agentMode}`，禁止返回硬编码值。
- AC-5: WHEN 用户切换权限模式, THE SYSTEM SHALL 调用 `agent:setPermissionMode` 并同步更新 `AppConfig.permissionMode`。
- AC-6: WHEN 用户切换模型, THE SYSTEM SHALL 更新 `AppConfig.model`，并将后续新查询的 `Options.model` 设为新模型。
- AC-7: IF AgentService 正在运行, THE SYSTEM SHALL 禁用 cwd 与 model 切换，或提示用户"将在新会话生效"。

## Out of Scope

- 持久化配置到磁盘（如 `userData/settings.json`）—— 当前依赖 `.env` 与运行时状态；持久化留给后续 spec。
- 配置面板完整 UI（所有字段的表单/抽屉）—— 本 spec 先覆盖状态栏展示与基础切换器；完整面板留给后续迭代。
- 工作目录的信任/安全确认（首次写入提示）—— 由 `permission-approval` 处理。
