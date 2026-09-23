# Design: diff-approval

## Context

实现 [requirements.md](./requirements.md)。本功能在 `permission-approval` 已建立的桥接基础上，仅增加"工具入参 → diff → 对话框嵌入"的渲染层能力。核心逻辑是一个纯函数 `diffFromToolInput`，完全可脱离 React 单测。

## Data Flow / Architecture

```
SDK canUseTool('Edit', {file_path, old_string, new_string})
        │
        ▼
Main: PermissionBridge.handler → webContents.send('permission:request', {...})
        │
        ▼
Renderer: PermissionDialog
  ├─ request.toolName + request.input
  ├─ diffFromToolInput(toolName, input) → {filePath, patch} | null
  ├─ diff ? <DiffPreview filePath={filePath} patch={patch} /> : null
  └─ 用户点击 allow/deny/alwaysAllow → permissionStore.respond(id, decision)
        │
        ▼
Main: PermissionBridge.respond(id, decision) → resolve canUseTool Promise
```

## Contracts

```ts
// src/renderer/src/lib/diffFromToolInput.ts
export function diffFromToolInput(
  toolName: string,
  input: Record<string, unknown> | undefined
): { filePath: string; patch: string } | null

// src/renderer/src/components/diff/DiffPreview.tsx
export function DiffPreview({
  filePath,
  patch
}: {
  filePath: string
  patch: string
}): React.JSX.Element

// PermissionDialog 中集成（已存在）
const diff = diffFromToolInput(request.toolName, request.input)
{diff && <DiffPreview filePath={diff.filePath} patch={diff.patch} />}
```

## Edge Cases

- `input` 为 `undefined` → `diffFromToolInput` 返回 `null`，不渲染 diff。
- `file_path` / `filePath` 字段混用 → `diffFromToolInput` 优先读 `file_path`，回退 `filePath`，再回退 `'file'`。
- `MultiEdit` 的 `edits` 为空数组 → 生成空 patch，`DiffPreview` 渲染空 body。
- `NotebookEdit` 当前仅展示文件路径，patch 为空（占位，后续可扩展）。
- patch 中同时存在上下文行（不以 `+/-/@@` 开头）→ `DiffPreview` 过滤掉上下文行，只保留变更行与 hunk 头。

## Alternatives Considered

- **在 PermissionBridge 主进程侧生成 diff**：可以，但会污染主进程与 SDK 桥接的纯粹性；且 diff 是 UI 展示细节，放在渲染层更合理。
- **为每个工具写独立组件**：过度设计；`diffFromToolInput` 的统一映射已足够表达 Edit/Write/MultiEdit/NotebookEdit 四种差异。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/3 | `src/renderer/src/lib/diffFromToolInput.test.ts` | Edit/Write/MultiEdit/NotebookEdit 生成 diff；非编辑工具返回 null |
| AC-2 | `src/renderer/src/components/diff/DiffPreview.test.tsx` | patch 行按 `+`/`-`/`@@` 着色 |
| AC-1/4/5/6 | `src/renderer/src/components/permissions/PermissionDialog.test.tsx` | Edit 工具调用时嵌入 diff；点击 allow/deny/alwaysAllow 调用 respond |
