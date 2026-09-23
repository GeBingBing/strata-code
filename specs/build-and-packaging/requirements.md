# Requirements: build-and-packaging

## Overview

构建与打包：约束 Electron + Vite 的构建流程，确保 `@anthropic-ai/claude-agent-sdk` 的原生二进制在开发与生产环境都能正确加载。核心红线：SDK 必须保持 externalized，禁止打包进 asar。

## Stakeholders

- **用户**: 打包后的应用必须能正常启动并调用 agent，不因原生模块缺失而崩溃。
- **开发者**: 构建配置是容易误改的"地雷区"；任何改动必须有 spec 约束。

## Assumptions

- 使用 `electron-vite` 构建 main / preload / renderer 三段。
- 使用 `electron-builder` 打包 macOS arm64 应用。
- `@anthropic-ai/claude-agent-sdk` 包含原生 `.node` 模块，必须在运行时从文件系统加载。

## Acceptance Criteria (EARS)

- AC-1: WHEN 执行 `npm run pack` 或 `npm run dist`, THE SYSTEM SHALL 将 `@anthropic-ai/claude-agent-sdk` 排除在 asar 之外（externalized）。
- AC-2: WHEN 打包后的应用运行时, THE SYSTEM SHALL 通过 `asarUnpack` 解开 SDK 与所有 `*.node` 原生模块。
- AC-3: WHEN 开发模式运行 (`npm run dev`), THE SYSTEM SHALL 使用 ESM preload，并保持 `contextIsolation: true` 与 `nodeIntegration: false`。
- AC-4: WHEN 执行 `npm run dist`, THE SYSTEM SHALL 输出 macOS arm64 产物（当前配置）。
- AC-5: WHEN 打包时 `CSC_IDENTITY_AUTO_DISCOVERY` 为 false 或 `identity` 为 null, THE SYSTEM SHALL 跳过代码签名（开发/CI 配置）。

## Out of Scope

- Windows / Linux 打包（当前仅 macOS）。
- 自动更新、签名证书配置、App Store 公证。
- 构建产物体积优化（tree-shaking、代码分割）。
