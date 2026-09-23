# Design: build-and-packaging

## Context

实现 [requirements.md](./requirements.md)。CLAUDE.md 已明确"SDK 必须保持 externalized"，但缺少 spec 层面的约束。本设计把 `electron.vite.config.ts` 与 `electron-builder.yml` 的当前决策文档化，并标记不可破坏的红线。

## Data Flow / Architecture

```
npm run pack
  │
  ├─ electron-vite build
  │    ├─ main: externalizeDepsPlugin → SDK 不打包进 out/main/index.js
  │    ├─ preload: externalizeDepsPlugin
  │    └─ renderer: externalizeDepsPlugin
  │
  └─ electron-builder --dir
       ├─ asarUnpack: ['node_modules/@anthropic-ai/claude-agent-sdk/**', '**/*.node']
       └─ release/mac/Claude SDK Agent.app
```

## Contracts

```ts
// electron.vite.config.ts
externalizeDepsPlugin() // 三段全部启用

// electron-builder.yml
asarUnpack:
  - 'node_modules/@anthropic-ai/claude-agent-sdk/**'
  - '**/*.node'
identity: null // 开发/CI 跳过签名
```

## Edge Cases

- SDK 升级后引入新的 `.node` 依赖 → `asarUnpack` 的 glob 已覆盖 `**/*.node`，无需修改。
- 新增其他原生依赖 → 同样被 `externalizeDepsPlugin` + `asarUnpack` 保护。
- 打包后启动报错 `Cannot find module '@anthropic-ai/claude-agent-sdk'` → 检查 asarUnpack 是否生效、SDK 是否在 node_modules 中。

## Alternatives Considered

- **把 SDK 打包进 asar**：会被否决，因为原生二进制无法在 asar 内被动态加载。
- **使用 `@electron/rebuild` 自动重建原生模块**：当前 electron-builder 已集成；若未来迁移需保留。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `npm run pack` | 检查 `release/mac/.../Contents/Resources/app.asar.unpacked/` 包含 SDK |
| AC-3 | `npm run dev` | 开发模式窗口加载 preload 成功 |
| AC-4 | `npm run dist` | 产物为 `.dmg` 或 `.app`，架构 arm64 |
| AC-5 | `npm run pack` | 日志显示 `skipped macOS code signing` |
