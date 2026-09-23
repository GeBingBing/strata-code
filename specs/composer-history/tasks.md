# Tasks: composer-history

## 1. chatStore 历史与草稿状态

- [x] 1.1 失败测试: send 把消息加入 history（去连续重复）；reset 清空 (AC-1/7) → `chatStore.test.ts`
- [x] 1.2 实现: chatStore 新增 `composerDraft`/`history`/`historyCursor`/`preHistoryDraft`

## 2. Composer UI

- [x] 2.1 失败测试: ArrowUp/Down 状态机（AC-2/3/4）→ `Composer.test.tsx`
- [x] 2.2 实现: Composer 文本从 chatStore.composerDraft 读；keydown 处理 ArrowUp/Down

## 3. 工作区草稿持久化

- [x] 3.1 失败测试: collectViewState 含 chatInputDraft；restoreViewState 回写 (AC-5/6) → `workspaceStore.test.ts`
- [x] 3.2 实现: workspaceStore.collectViewState 接 composerDraft；输入 500ms 防抖调 updateState；restoreViewState 把 chatInputDraft 写回 chatStore.composerDraft

## 4. 回归验证

- [x] 4.1 typecheck + 全套单测
- [ ] 4.2 手动 dev：输入 → 切 workspace → 回到原 workspace 草稿恢复
