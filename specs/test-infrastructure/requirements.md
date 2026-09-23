# Requirements: test-infrastructure

## Overview

测试基础设施：统一约束主进程/渲染进程/E2E 三层测试的替身工厂、IPC 注入方式与元素选择约定。本 spec 让测试代码与产品代码之间的"隐式接口"显式化，降低后续重构破坏测试的风险。

## Stakeholders

- **开发者**: 需要稳定、可复用的测试替身；修改 IPC 或组件时必须知道哪些 testid 是公共接口。
- **CI**: 需要统一的 fake 模式门禁，确保无网络依赖。

## Assumptions

- 主进程测试运行在 node 环境；渲染层测试运行在 jsdom + React Testing Library；E2E 使用 Playwright。
- `app-shell` 已定义 `InvokeChannels` / `EventChannels` 类型。
- `sdk-mock` 已定义 `createMockQuery`。

## Acceptance Criteria (EARS)

- AC-1: WHEN 主进程测试需要 fake IPC, THE SYSTEM SHALL 提供 `createFakeIpcMain()` 工厂，支持注册 handler 与断言 invoke 调用。
- AC-2: WHEN 主进程测试需要 fake WebContents, THE SYSTEM SHALL 提供 `createFakeWebContents()` 工厂，支持 `send` / `once` / `isDestroyed` 断言。
- AC-3: WHEN 渲染层测试需要 fake IPC, THE SYSTEM SHALL 通过 `setIpcOverride()` 注入 invoke/subscribe 实现，不依赖真实 preload。
- AC-4: WHEN E2E 或单测选择 UI 元素, THE SYSTEM SHALL 使用约定前缀：`message-*`、`tool-card-*`、`permission-*`、`diff-*`。
- AC-5: WHEN 新增需要测试访问的 UI 元素, THE SYSTEM SHALL 遵循上述前缀并补充到本 spec。
- AC-6: WHEN CI 执行测试, THE SYSTEM SHALL 以 fake 模式完成 E2E，禁止真实网络调用。

## Out of Scope

- 具体业务逻辑的测试策略（分散在各功能 spec 的 Test Strategy 中）。
- 性能测试、视觉回归测试。
- 多平台 E2E（当前仅 macOS arm64）。
