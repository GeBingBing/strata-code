# Tasks: build-and-packaging

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 配置归档

- [x] 1.1 归档: `electron.vite.config.ts` 三段均启用 `externalizeDepsPlugin` (AC-1)
- [x] 1.2 归档: `electron-builder.yml` 的 `asarUnpack` 包含 SDK 与 `*.node` (AC-2)
- [x] 1.3 归档: `main/index.ts` 中 `sandbox: false` + `contextIsolation: true` + `nodeIntegration: false` (AC-3)
- [x] 1.4 归档: `electron-builder.yml` `identity: null` 跳过签名 (AC-5)

## 2. 构建验证

- [x] 2.1 运行 `npm run pack` 确认产物生成且无签名错误 (AC-4/5)
- [x] 2.2 检查 `release/mac/Claude SDK Agent.app/Contents/Resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk` 存在 (AC-1/2)
- [x] 2.3 运行 `npm run dev` 确认开发模式窗口正常加载 (AC-3)

## 3. 回归验证

- [x] 3.1 运行 `npm run typecheck`
- [x] 3.2 运行 `npm run test:e2e`（依赖打包产物）
