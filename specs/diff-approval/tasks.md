# Tasks: diff-approval

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. diff 生成纯函数

- [x] 1.1 失败测试: `diffFromToolInput` 对 Edit/Write/MultiEdit/NotebookEdit 返回 `{filePath, patch}`；非编辑工具返回 null (AC-1/3) → `src/renderer/src/lib/diffFromToolInput.test.ts`
- [x] 1.2 实现: `src/renderer/src/lib/diffFromToolInput.ts`
- [x] 1.3 重构: 处理 `file_path` / `filePath` 混用与空 edits 边界

## 2. Diff 预览组件

- [x] 2.1 失败测试: `DiffPreview` 渲染文件路径与按 `+`/`-`/`@@` 着色的行 (AC-2) → `src/renderer/src/components/diff/DiffPreview.test.tsx`
- [x] 2.2 实现: `src/renderer/src/components/diff/DiffPreview.tsx`
- [x] 2.3 重构: 提取行类型判断，保持组件薄

## 3. 权限对话框集成

- [x] 3.1 失败测试: `PermissionDialog` 在 Edit 工具请求时嵌入 `DiffPreview`；点击 allow/deny/alwaysAllow 正确调用 `respond` (AC-1/4/5/6) → `src/renderer/src/components/permissions/PermissionDialog.test.tsx`
- [x] 3.2 实现: 在 `PermissionDialog.tsx` 中调用 `diffFromToolInput` 并条件渲染 `DiffPreview`
- [x] 3.3 重构: 清理 diff 相关内联逻辑，确保不破坏 PermissionBridge 防悬挂行为

## 4. 回归验证

- [x] 4.1 运行 `npm run test:renderer` 确保 diff-approval 相关测试通过
- [x] 4.2 运行 `npm run test:e2e` 确保 fake 模式权限流程未被破坏
- [x] 4.3 运行 `npm run typecheck`
