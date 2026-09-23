# Tasks: error-recovery

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 重试功能

- [x] 1.1 失败测试: `Composer` 在 `status === 'error'` 时显示"重试"按钮 (AC-1) → `src/renderer/src/components/chat/Composer.test.tsx`
- [x] 1.2 失败测试: 点击"重试"后，`chatStore.retry` 用最后一条 user 消息调用 `agent:send` 并切到新会话 (AC-2) → `src/renderer/src/components/chat/Composer.test.tsx`
- [x] 1.3 实现: `chatStore.retry()` 与 `Composer` 中的重试按钮
- [x] 1.4 重构: 内联"最后一条 user 消息"选择逻辑

## 2. 重新生成功能

- [x] 2.1 失败测试: `MessageItem` 在 assistant 消息上显示"重新生成"按钮 (AC-3) → `src/renderer/src/components/chat/MessageItem.test.tsx`
- [x] 2.2 失败测试: 点击"重新生成"后调用 `agent:send` 并保留历史消息 (AC-4/5) → `src/renderer/src/components/chat/MessageItem.test.tsx`
- [x] 2.3 实现: `chatStore.regenerate(messageId)` 与 `MessageItem` 重新生成按钮
- [x] 2.4 重构: regenerate 复用现有 send 流程，不破坏 partial/final 去重逻辑

## 3. 防死循环

- [x] 3.1 失败测试: 再次 agent:error 时仍显示重试按钮，不自动触发 (AC-6) → `src/renderer/src/components/chat/Composer.test.tsx`
- [x] 3.2 实现: 错误状态由 `agent:error` 事件设置；retry 调用 `reset()` + `send()` 后状态回到 running

## 4. 回归验证

- [x] 4.1 运行 `npm run test:renderer` — 12 files, 51 tests passed
- [x] 4.2 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 4.3 运行 `npm run typecheck` — passed
- [x] 4.4 运行 `npm run test:main` — 7 files, 42 tests passed
- [x] 4.5 运行 `npm run pack` — passed
