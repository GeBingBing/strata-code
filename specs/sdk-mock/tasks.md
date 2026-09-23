# Tasks: sdk-mock

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. Mock 契约测试

- [x] 1.1 失败测试: `createMockQuery` 返回 factory + spies + accessors (AC-1) → `tests/mocks/sdk.test.ts`
- [x] 1.2 失败测试: factory 按 script 顺序产出消息；空 script 立即 done (AC-2/6) → `tests/mocks/sdk.test.ts`
- [x] 1.3 失败测试: push 用户消息后 `receivedInputs()` 包含该消息 (AC-3) → `tests/mocks/sdk.test.ts`
- [x] 1.4 失败测试: `interrupt` / `setPermissionMode` / `setModel` 为可调用的 spy (AC-4) → `tests/mocks/sdk.test.ts`
- [x] 1.5 失败测试: `lastOptions()` 保存最近一次 options (AC-5) → `tests/mocks/sdk.test.ts`

## 2. 实现 / 归档

- [x] 2.1 实现: `tests/mocks/sdk.ts` 的 `createMockQuery`
- [x] 2.2 重构: 确保 mock Query 类型与真实 SDK Query 兼容

## 3. 回归验证

- [x] 3.1 运行 `npm run test:main`
- [x] 3.2 运行 `npm run typecheck`
