# Design: search-navigation

## Context

实现 [requirements.md](./requirements.md)。当前 SearchPanel（`src/renderer/src/components/sidebar/SearchPanel.tsx`）只展示结果，无 onClick。

## Contracts

- `editorStore`：新增 `pendingCursor: {path, line, column} | null`；`open(path, opts)` opts 增加可选 `cursor: {line, column?: number}`；`open` 写入 pendingCursor。
- `EditorArea`：在 `editorRef` 中保存 Monaco 实例；`useEffect` 监听 `pendingCursor && activePath === pendingCursor.path` → `revealLineInCenter` + `setPosition({lineNumber, column: column ?? 1})` + `focus()` → 清除 pendingCursor。
- `SearchPanel` li onClick：`invoke('file:read', {path})` → `open(path, {...meta, cursor: {line}})` → 失败时（删除/权限）显示 toast（待后续）。

## Edge Cases

- 已打开 tab：`open` 已有的「set activePath」短路，仍需设置 pendingCursor —— 在 open 内无条件写 pendingCursor（仅 path 不同时重置 tab 列表）。
- 行号越界：EditorArea 端 clamp 到 `model.getLineMaxColumn(line)`。
- Monaco 未加载：useEffect 不依赖 onMount 路径，pendingCursor 等下次重挂。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `SearchPanel.test.tsx` | 模拟 file:read + 验证 open 调用带 cursor |
| AC-2 | `SearchPanel.test.tsx` | 重复点击同一文件 → 仍写 pendingCursor |
| AC-3 | `EditorArea.test.tsx`（新增） | 注入 mock editor，pendingCursor 大于行数时 clamp |
| AC-4 | `SearchPanel.test.tsx` | 二进制文件结果点击 → 不报错 |
