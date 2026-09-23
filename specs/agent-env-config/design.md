# Design: agent-env-config

## Context

实现 [requirements.md](./requirements.md)，让真实模式对接 MiniMax 的 Anthropic 兼容端点。

## Data Flow

```
.env（项目根 / userData）
  → loadEnvOverrides()（纯函数，无依赖解析器）
  → main/index.ts 合并 { ...process.env, ...overrides }
  → AgentService.options.env
  → query({ options: { env } }) → SDK 子进程
```

## Contracts

```ts
// src/main/config/env.ts
export function parseEnvFile(content: string): Record<string, string>
export async function loadEnvOverrides(paths: string[]): Promise<Record<string, string>>

// AgentServiceOptions 增加 env?: Record<string, string | undefined>
// start() 的 Options.env = this.options.env（由 main 组装好，含 process.env 展开）
```

MiniMax 配置示例（.env）：
```
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_AUTH_TOKEN=<MiniMax API Key>
ANTHROPIC_MODEL=MiniMax-M2
```

## Edge Cases

- 引号内含 `=` → 以第一个 `=` 分割。
- BOM/尾随空白 → trim。
- 同名多文件 → 后加载的覆盖先前的。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/3 | `tests/main/config/env.test.ts` | 基本 KV、注释/空行/引号、值含 = |
| AC-2 | 同上 | 空内容/缺失文件 → {} |
| AC-4 | `tests/main/agent/AgentService.test.ts` | factory 收到的 options.env 含覆盖值 |
