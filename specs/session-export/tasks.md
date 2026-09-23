# Tasks: session-export

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 单条消息复制

- [x] 1.1 失败测试: `MessageItem` 显示"复制"按钮；点击后写入剪贴板 (AC-1) → `src/renderer/src/components/chat/MessageItem.test.tsx`
- [x] 1.2 实现: 在 `MessageItem` 中为 user/assistant/error 消息增加复制按钮，调用 `navigator.clipboard.writeText`
- [x] 1.3 重构: 提供 raw/markdown 切换选项 → `src/renderer/src/lib/markdownToPlainText.ts` + MessageItem 的 CopyButtonGroup（copy-raw-{id} / copy-md-{id}）

## 2. 整会话导出

- [x] 2.1 失败测试: `exportToMarkdown` / `exportToJson` 格式化 (AC-2/3/4) → `src/renderer/src/lib/sessionExport.test.ts`
- [x] 2.2 实现: `src/renderer/src/lib/sessionExport.ts` 格式化逻辑；`chatStore.exportSession(format)` 调用 `session:export`
- [x] 2.3 实现: `src/main/index.ts` 注册 `session:export` handler，负责 `dialog.showSaveDialog` + `fs.writeFile`
- [x] 2.4 失败测试: 取消保存对话框不报错 (AC-5) → 由主进程 handler 直接 return
- [x] 2.5 实现: UI 入口在 `AppShell` 主工具栏（导出 MD / 导出 JSON 按钮）

## 3. 回归验证

- [x] 3.1 运行 `npm run test:main` — 7 files, 42 tests passed
- [x] 3.2 运行 `npm run test:renderer` — 13 files, 55 tests passed
- [x] 3.3 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 3.4 运行 `npm run typecheck` — passed
- [x] 3.5 运行 `npm run pack` — passed
