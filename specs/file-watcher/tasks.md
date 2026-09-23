> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。

# Tasks: file-watcher

## 1. FileWatcher 服务

- [x] 1.1 失败测试: 临时目录写入文件触发 file:changed 事件（AC-2/4）→ `tests/main/fileWatcher.test.ts`
- [x] 1.2 失败测试: 写入路径在 suppress 窗口内被丢弃（AC-4）→ 同上
- [x] 1.3 实现: `src/main/files/fileWatcher.ts`：fs.watch + 150ms 去抖 + 路径过滤 + 自写抑制

## 2. IPC 通道 + 主进程集成

- [x] 2.1 实现: `src/shared/ipc.ts` 新增 `file:changed` 事件
- [x] 2.2 实现: `src/main/index.ts` 实例化 watcher 并在 cwd 变化处重挂；`before-quit` dispose
- [x] 2.3 实现: 自写抑制与 fileService.write 集成（路径 + 时间戳）

## 3. 渲染层响应

- [x] 3.1 失败测试: `editorStore.reloadFromDisk` 不改 dirty；`markConflict` 置 conflict=true（AC-3）→ `src/renderer/src/state/editorStore.test.ts`
- [x] 3.2 实现: editorStore 新增字段与 actions；`App.tsx` 订阅 file:changed 并分发
- [x] 3.3 实现: FileTree 监听 file:changed 触发刷新

## 4. 回归验证

- [x] 4.1 `npm run typecheck` — passed
- [x] 4.2 `npm run test:main` + `test:renderer` — passed
- [ ] 4.3 手动: 外部 `echo > file.ts` → 编辑器自动重载
