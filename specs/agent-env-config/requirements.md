# Requirements: agent-env-config

## Overview

SDK 子进程环境配置：支持项目根目录 `.env` 文件（或打包后的 userData 目录）注入 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` 等变量，使真实模式可对接任何 Anthropic 兼容端点（如 MiniMax）。GUI 应用从 Finder/Dock 启动时没有 shell 环境变量 —— 必须有文件级配置。

## Stakeholders

- **用户**: 使用第三方 Anthropic 兼容模型（MiniMax 等），需要在 UI 外安全地配置端点/key/模型。
- **开发者**: AgentService 需要显式传递 env（SDK 的 options.env 会整体替换子进程环境，必须展开 process.env）。

## Assumptions

- SDK `options.env` 语义：设置后**完全替换**子进程环境 → 必须 `{ ...process.env, ...overrides }`。
- `.env` 已在 .gitignore，不进版本库。
- 值支持单引号/双引号包裹与裸文本；`#` 开头为注释。

## Acceptance Criteria (EARS)

- AC-1: WHEN 存在 `.env` 文件, THE SYSTEM SHALL 解析 KEY=VALUE 行并合并进 SDK 子进程环境（覆盖同名 process.env 值）。
- AC-2: IF `.env` 不存在或为空, THE SYSTEM SHALL 使用原始 process.env（不报错）。
- AC-3: WHEN 解析含注释行、空行、引号包裹值, THE SYSTEM SHALL 正确跳过注释/空行并剥离引号。
- AC-4: WHEN AgentService 启动查询, THE SYSTEM SHALL 以 `{ ...process.env, ...配置覆盖 }` 作为 options.env 传入 query()。

## Out of Scope

- 设置 UI 与 safeStorage 加密存储（packaging-e2e spec）。
- 多 profile 切换。
