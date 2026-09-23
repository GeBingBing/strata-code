> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: search-navigation

## 1. editorStore pendingCursor

- [x] 1.1 失败测试: `open` 支持 cursor 参数；`pendingCursor` 写入并被消费清除 (AC-1/2) → `src/renderer/src/state/editorStore.test.ts`
- [x] 1.2 实现: `editorStore.ts` 新增 `pendingCursor` 状态字段与 `cursor` open 选项

## 2. EditorArea reveal 效果

- [x] 2.1 实现: `EditorArea` 保存 `editorRef`；effect 监听 pendingCursor → `revealLineInCenter` + `setPosition` + `focus` → 清除 (AC-1)
- [x] 2.2 实现: 行号越界 clamp（AC-3）

## 3. SearchPanel onClick

- [x] 3.1 失败测试: 点击 li 触发 file:read 并 open 带 cursor (AC-1) → `src/renderer/src/components/sidebar/SearchPanel.test.tsx`
- [x] 3.2 实现: `SearchPanel.tsx` li 加 onClick 处理器，cursor 来自结果 line

## 4. 回归验证

- [x] 4.1 `npm run typecheck` — passed
- [x] 4.2 `npm run test:renderer` — passed
- [ ] 4.3 手动: dev 中 search "hello" → 点击结果跳转到行
