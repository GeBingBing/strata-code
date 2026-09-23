# Tasks: memory-rendering

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. reducer（applySdkMessage）

- [x] 1.1 失败测试: SDK memory_recall → UiItem {kind:'memory', source:'sdk'}；uuid 去重；content 缺失显示 path basename → `src/renderer/src/lib/applySdkMessage.test.ts` (AC-1)
- [x] 1.2 失败测试: applyMemoryRecalled 追加 source:'app' 条目；按条目内容去重 → 同上 (AC-2)
- [x] 1.3 失败测试: compact_boundary → UiItem {kind:'compact'} → 同上 (AC-4)
- [x] 1.4 实现 reducer 扩展 + ChatState.lastDistill

## 2. 组件与 store

- [x] 2.1 失败测试: MemoryRecallBlock 渲染标头/条目/testid/data-source/data-kind → `src/renderer/src/components/chat/MemoryRecallBlock.test.tsx` (AC-3)
- [x] 2.2 失败测试: MessageItem 渲染 memory 与 compact 分隔线 → `src/renderer/src/components/chat/MessageItem.test.tsx` 扩展 (AC-3/4)
- [x] 2.3 失败测试: chatStore.connect 订阅 memory:recalled/distilled（setIpcOverride 注入捕获式 api）→ `src/renderer/src/state/chatStore.memory.test.ts`
- [x] 2.4 失败测试: StatusBar "记忆 +N" 徽标 → `src/renderer/src/components/chat/StatusBar.test.tsx` 扩展 (AC-5)
- [x] 2.5 失败测试: sessionExport 新 kind → `src/renderer/src/lib/sessionExport.test.ts` (AC-6)
- [x] 2.6 实现: MemoryRecallBlock / AssistantTurn 扩展（memory/compact 进入渲染路径）/ MessageItem / StatusBar / chatStore / sessionExport

## 3. E2E

- [x] 3.1 E2E: 发送 → memory-recall 块可见（source=sdk）→ idle 后 memory-distill 徽标"记忆 +1"可见 → `tests/e2e/memory.spec.ts` (AC-7)
- [x] 3.2 E2E 回归: chat.spec.ts / sessions.spec.ts 全绿
