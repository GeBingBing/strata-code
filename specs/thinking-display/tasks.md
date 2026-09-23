# Tasks: thinking-display

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 状态解析

- [x] 1.1 失败测试: `applySdkMessage` 将 thinking content block 解析进 assistant UiItem (AC-1/4) → `src/renderer/src/lib/applySdkMessage.test.ts`
- [x] 1.2 实现: 更新 `applySdkMessage.ts` 中的 assistant 消息解析逻辑，支持 `thinking` content block
- [x] 1.3 重构: `applyPartial` 同时处理 `text_delta` 与 `thinking_delta`，确保同一流式气泡累积正确

## 2. UI 组件

- [x] 2.1 失败测试: `ThinkingBlock` 折叠/展开/空文本行为 (AC-2/3/5) → `src/renderer/src/components/chat/ThinkingBlock.test.tsx`
- [x] 2.2 实现: `src/renderer/src/components/chat/ThinkingBlock.tsx`
- [x] 2.3 失败测试: `MessageItem` 在 assistant 消息中渲染 `ThinkingBlock` (AC-1/4) → `src/renderer/src/components/chat/MessageItem.test.tsx`
- [x] 2.4 实现: 在 `MessageItem` 中集成 `ThinkingBlock`，流式阶段隐藏

## 3. 回归验证

- [x] 3.1 运行 `npm run test:renderer` — 14 files, 62 tests passed
- [x] 3.2 运行 `npm run test:main` — 7 files, 42 tests passed
- [x] 3.3 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 3.4 运行 `npm run typecheck` — passed
- [x] 3.5 运行 `npm run pack` — passed
