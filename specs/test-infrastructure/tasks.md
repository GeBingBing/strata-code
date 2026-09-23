# Tasks: test-infrastructure

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 主进程 fake 工厂

- [x] 1.1 归档: `tests/main/` 各测试文件中的 `createFakeWin` / `createFakeIpcMain` 工厂 (AC-1/2)
- [x] 1.2 失败测试: 抽取公共 fake 工厂到 `tests/main/fakes.ts` 并保证现有测试可迁移 (AC-1/2)
- [x] 1.3 实现: 公共 fake 工厂（可选，本 spec 以文档化为主）

## 2. 渲染层 fake IPC

- [x] 2.1 归档: `src/renderer/src/ipc/client.ts` 的 `setIpcOverride` (AC-3)
- [x] 2.2 实现: 渲染层组件测试使用 `setIpcOverride`

## 3. data-testid 约定

- [x] 3.1 归档: CLAUDE.md 中 `message-*` / `tool-card-*` / `permission-*` / `diff-*` 前缀 (AC-4/5)
- [x] 3.2 失败测试: lint 或 grep 检查新增 UI 元素 testid 前缀合规 (AC-5) → `src/renderer/src/testids.test.ts`
- [ ] 3.3 实现: 可选添加 eslint 规则或 pre-commit 检查

## 4. CI fake 模式门禁

- [x] 4.1 归档: E2E helper 强制 `APP_AGENT_MODE=fake` (AC-6)
- [x] 4.2 实现: `tests/e2e/helpers.ts` 的 `launchApp`

## 5. 回归验证

- [x] 5.1 运行 `npm run test:main`
- [x] 5.2 运行 `npm run test:renderer`
- [x] 5.3 运行 `npm run test:e2e`
- [x] 5.4 运行 `npm run typecheck`
