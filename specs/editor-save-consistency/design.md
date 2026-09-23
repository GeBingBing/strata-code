# Design: editor-save-consistency

## Context

实现 [requirements.md](./requirements.md)。当前数据流缺陷：

```
Monaco onChange → setEditorContent (本地态)        ←── 只走这里
save()         → invoke('file:write', editorContent) → updateContent → markSaved
palette save   → invoke('file:write', tab.content)   ←── tab.content 从未被输入更新 = 数据丢失
```

## Data Flow（修复后）

```
Monaco onChange → setEditorContent(v) + updateContent(path, v)   ←── store 成为事实源，dirty 实时
save() (Monaco/palette) → invoke('file:write', store.content) → 成功才 markSaved
外部通道（file-watcher 未来）→ updateContent/reloadFromDisk → effect 比对守卫 → setEditorContent
```

## Contracts

- `EditorArea` 同步 effect：
  - tab 切换（`activePath` 变化）：`setEditorContent(active.content)` + 重置 monacoFailed。
  - 外部内容变化（`active?.content` 变化且 `!== contentRef.current`）：同步；相等则不动（守卫依赖 ref 比对，避免 effect 闭包读到过期本地态）。
- `registerCommands.ts` `editor.save`：
  ```ts
  action: async () => {
    const path = useEditorStore.getState().activePath
    if (!path) return
    const tab = useEditorStore.getState().tabs.find((t) => t.path === path)
    if (!tab || tab.isBinary || tab.isTooLarge) return
    try {
      await invoke('file:write', { path: tab.path, content: tab.content })
      useEditorStore.getState().markSaved(path)
    } catch {
      // 失败保留 dirty（AC-3）
    }
  }
  ```
- `StatusBar.tsx`：删除 `if (dirtyCount > 0) { void Promise.resolve() }` 死代码块。

## Edge Cases

- 二进制/超大占位：未挂载 Monaco，palette save 直接 no-op。
- 快速连续 Cmd+S：写入幂等，无队列化需求。
- 用户输入与外部重载竞争：守卫仅在值不等时同步；值相等时（自写回声）不打扰光标。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `src/renderer/src/state/editorStore.test.ts`（新增） | `updateContent` 输入即置 dirty 并更新 content |
| AC-2/3 | `src/renderer/src/lib/registerCommands.test.ts`（新增或扩展） | palette save 写最新内容；IPC 失败不 markSaved |
| AC-4/5 | 手动 + e2e | 切 tab 内容正确；外部 updateContent 同步编辑器 |
| AC-6 | `StatusBar.test.tsx` 回归 | 既有测试全绿 |
