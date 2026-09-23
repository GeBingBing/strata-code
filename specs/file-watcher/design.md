# Design: file-watcher

## Context

实现 [requirements.md](./requirements.md)。

## Architecture

```
FileWatcher.watch(root):
  fs.watch(root, {recursive: true}) → debounce 150ms/路径
  filter: skip node_modules, .git, dotfiles, dist/, out/
  suppress: 自己 file:write 后 N=750ms 内的同路径事件
  emit: sendEvent(win, 'file:changed', {path, kind:'change'|'rename'})
```

主进程 `index.ts` 实例化 watcher；`workspace:open` / `workspace:switch` / `config:set(cwd)` 中重挂。

渲染层 `App.tsx` 在 connect 中订阅 `file:changed` → 分发到 FileTree / editorStore。
editorStore 新增 `conflict?: boolean` 字段 + `markConflict(path)` action + `reloadFromDisk(path, content, mtime)` action（不置 dirty）。

## IPC Contracts

- 事件：`src/shared/ipc.ts` 新增 `'file:changed': (p: {path: string; kind: 'change' | 'rename'}) => void`

## Edge Cases

- 自写回声：主进程维护 `recentWrites: Map<path, timestamp>`，writeFile 后 750ms 内同路径事件丢弃。
- Linux 递归不支持：`watch` 监听时 try/catch，失败回退为 top-level dirs。
- FileTree 递归刷新：FileTree 已有 reload action，外部触发即可。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-2/4 | `tests/main/fileWatcher.test.ts` | 临时目录写入 → 收到事件；自写抑制 |
| AC-5 | 同上 | 不存在的目录不抛错 |
| AC-3 | `src/renderer/src/state/editorStore.test.ts` | reloadFromDisk 不改 dirty；markConflict 置位 |
