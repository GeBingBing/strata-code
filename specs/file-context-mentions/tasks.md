> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: file-context-mentions

## 1. 扩展 UiItem user 与相关渲染/导出

- [x] 1.1 失败测试: `applySdkMessage` 保留带 `attachments` 的 user item (AC-3) → `src/renderer/src/lib/applySdkMessage.test.ts`
- [x] 1.2 失败测试: `MessageItem` 渲染 user item 的 attachment chips (AC-3) → `src/renderer/src/components/chat/MessageItem.test.tsx`
- [x] 1.3 失败测试: `sessionExport` 在 Markdown/JSON 中保留 attachments (AC-5) → `src/renderer/src/lib/sessionExport.test.ts`
- [x] 1.4 实现: 修改 `src/renderer/src/lib/applySdkMessage.ts` 的 `UiItem.user` 增加 `attachments?: MentionAttachment[]`
- [x] 1.5 实现: 修改 `src/renderer/src/components/chat/MessageItem.tsx` 渲染 chips
- [x] 1.6 实现: 修改 `src/renderer/src/components/chat/AssistantTurn.tsx` 类型引用（无结构变化）
- [x] 1.7 实现: 修改 `src/renderer/src/lib/sessionExport.ts` 导出 attachments
- [x] 1.8 实现: `src/shared/types.ts` 新增 `MentionAttachment`

## 2. MentionPicker 组件

- [x] 2.1 失败测试: 输入 `@` 弹出 MentionPicker；键盘上下选择；回车选中 (AC-1/2) → `src/renderer/src/components/chat/MentionPicker.test.tsx`
- [x] 2.2 实现: 新增 `src/renderer/src/components/chat/MentionPicker.tsx`
- [x] 2.3 实现: 基于当前工作区 `file:list` 构建可搜索文件树，支持文件与文件夹
- [x] 2.4 重构: 将文件树搜索逻辑抽到纯函数 `filterMentions(items, query)`

## 3. Prompt 组装（主进程）

- [x] 3.1 失败测试: `assembleContext` 读取文件并拼接到 prompt (AC-4) → `tests/main/contextAssembler.test.ts`
- [x] 3.2 失败测试: 文件夹附件展开为多个文件；大文件/二进制只保留元数据 (AC-4/6) → `tests/main/contextAssembler.test.ts`
- [x] 3.3 实现: 新增 `src/main/contextAssembler.ts`
- [x] 3.4 实现: `src/main/index.ts` 的 `agent:send` handler 调用 `assembleContext`
- [x] 3.5 重构: 最大附件总长度限制，超长时追加截断提示

## 4. Composer 与 chatStore 集成

- [x] 4.1 失败测试: `Composer` 检测 `@`、渲染 chips、删除 chip (AC-1/2/3) → `src/renderer/src/components/chat/Composer.test.tsx`
- [x] 4.2 失败测试: `chatStore.send` 把 attachments 透传给 `agent:send` (AC-3/4) → `src/renderer/src/state/chatStore.send.test.ts`
- [x] 4.3 实现: 修改 `src/renderer/src/components/chat/Composer.tsx` 增加 attachments 状态与 MentionPicker
- [x] 4.4 实现: 修改 `src/renderer/src/state/chatStore.ts` 的 `send(text, attachments?)`
- [x] 4.5 实现: `src/shared/ipc.ts` 更新 `agent:send` payload 类型
- [x] 4.6 重构: 发送后清空 attachments

## 5. 回归验证

- [x] 5.1 运行 `npm run typecheck` — passed
- [x] 5.2 运行 `npm run test:main` — passed
- [x] 5.3 运行 `npm run test:renderer` — passed
- [ ] 5.4 运行 `npm run test:e2e` — passed（需 build，未在此会话运行）
- [ ] 5.5 运行 `npm run pack` — passed（需 build，未在此会话运行）
