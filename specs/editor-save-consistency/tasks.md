> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: editor-save-consistency

## 1. store 成为编辑器事实源

- [x] 1.1 失败测试: `updateContent` 在输入时同步 content 并置 dirty (AC-1) → `src/renderer/src/state/editorStore.test.ts`
- [x] 1.2 实现: `EditorArea.tsx` onChange 同时调用 `setEditorContent` 与 `updateContent`；textarea fallback 同步处理
- [x] 1.3 实现: 同步 effect 拆分为 tab 切换（`activePath`）与外部内容变化（ref 比对守卫）两条通道 (AC-4/5)

## 2. 命令面板保存写最新内容

- [x] 2.1 失败测试: palette `editor.save` 以 store 最新 content 调 `file:write`；IPC 失败不 `markSaved` (AC-2/3) → `src/renderer/src/lib/registerCommands.test.ts`
- [x] 2.2 实现: 修改 `registerCommands.ts` 的 `editor.save`；二进制/超大占位 no-op
- [x] 2.3 重构: Monaco `save()` 同样改从 store 读 content（与 palette 路径统一）

## 3. 死代码清理

- [x] 3.1 实现: 删除 `StatusBar.tsx` 的 `void Promise.resolve()` 占位块 (AC-6)

## 4. 回归验证

- [x] 4.1 `npm run typecheck` — passed
- [x] 4.2 `npm run test:renderer` — 32 files, 147 tests passed
- [ ] 4.3 手动: dev 中输入 → 面板保存 → 磁盘内容为最新
