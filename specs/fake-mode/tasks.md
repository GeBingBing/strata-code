# Tasks: fake-mode

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. FakeAgent 单元测试

- [x] 1.1 失败测试: `createFakeQueryFactory` 产出固定脚本消息序列（system/init → partial×2 → assistant(text) → assistant(tool_use: Read) → user(tool_result) → result(success)）(AC-1/3) → `tests/main/agent/FakeAgent.test.ts`
- [x] 1.2 实现: `src/main/agent/FakeAgent.ts`
- [x] 1.3 重构: 确保 fake Query 接口与真实 SDK Query 形态一致（interrupt / setPermissionMode / setModel 等 no-op 或 spy）

## 2. AgentService 注入

- [x] 2.1 失败测试: `isFakeMode()` 为真时，AgentService 使用 fake factory 而非真实 SDK (AC-1/2) → `tests/main/agent/AgentService.test.ts`
- [x] 2.2 实现: `src/main/index.ts` 中的 factory 选择逻辑
- [x] 2.3 重构: 抽离 `isFakeMode()` 便于测试

## 3. E2E 与配置报告

- [x] 3.1 失败测试: E2E `launchApp()` 强制 `APP_AGENT_MODE=fake` 并能完成聊天流程 (AC-4) → `tests/e2e/chat.spec.ts`
- [x] 3.2 失败测试: `config:get` 在 fake 模式下返回 `agentMode: 'fake'` (AC-5) → `tests/e2e/chat.spec.ts` 或主进程测试
- [x] 3.3 实现: E2E helper 注入 fake 环境变量；`config:get` handler 报告 agentMode

## 4. 回归验证

- [x] 4.1 运行 `npm run test:main`
- [x] 4.2 运行 `npm run test:e2e`
- [x] 4.3 运行 `npm run typecheck`
