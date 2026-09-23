> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: workspace-management

## 1. WorkspaceStore 主进程持久化

- [x] 1.1 失败测试: `WorkspaceStore.upsert` 创建 workspace；重复 path 复用；`list` 返回持久化数据 (AC-1/5) → `tests/main/workspace/WorkspaceStore.test.ts`
- [x] 1.2 失败测试: `addOpen`/`removeOpen`/`setActive`/`updateState`/`getState` 行为正确 (AC-2/3/4/5) → `tests/main/workspace/WorkspaceStore.test.ts`
- [x] 1.3 实现: 新增 `src/main/workspace/WorkspaceStore.ts`，遵循 SessionStore/MemoryStore 的懒加载缓存 + tmp+rename 原子写模式
- [x] 1.4 重构: 提取 workspace id 生成逻辑为纯函数 `workspaceId(path)`

## 2. IPC 与主进程 handler

- [x] 2.1 失败测试: 调用 `workspace:list/open/close/switch/updateState` 返回预期结构 → `tests/main/workspace.test.ts`
- [x] 2.2 实现: `src/shared/ipc.ts` 新增 5 条 workspace invoke 通道；`src/shared/types.ts` 新增 `Workspace`/`WorkspaceViewState`
- [x] 2.3 实现: `src/main/index.ts` 实例化 `WorkspaceStore` 并注册 handler；切换 cwd 时自动 `upsert` 当前 workspace
- [x] 2.4 重构: 主进程 `config:set` cwd 时复用同一 upsert 逻辑

## 3. 渲染层 workspaceStore

- [x] 3.1 失败测试: `workspaceStore.load()` 初始化 workspaces/openIds/activeId；`open(path)` 新增并激活 (AC-1/5) → `src/renderer/src/state/workspaceStore.test.ts`
- [x] 3.2 失败测试: `switch(id)` 先保存当前状态再切换；`close(id)` 更新 activeId (AC-2/3/4) → `src/renderer/src/state/workspaceStore.test.ts`
- [x] 3.3 实现: 新增 `src/renderer/src/state/workspaceStore.ts`
- [x] 3.4 实现: `App.tsx` 挂载时调用 `workspaceStore.load()`，无持久化工作区时以当前 `cwd` 作为默认工作区打开

## 4. 工作区标签栏 UI

- [x] 4.1 失败测试: `WorkspaceTabs` 渲染已打开工作区；点击切换；点击 × 关闭 (AC-2/3) → `src/renderer/src/components/workspace/WorkspaceTabs.test.tsx`
- [x] 4.2 失败测试: 无打开工作区时不渲染标签栏 (AC-3) → `src/renderer/src/components/workspace/WorkspaceTabs.test.tsx`
- [x] 4.3 实现: 新增 `src/renderer/src/components/workspace/WorkspaceTabs.tsx`
- [x] 4.4 实现: `AppShell.tsx` 在 main-toolbar 上方插入 `WorkspaceTabs`
- [x] 4.5 重构: 标签栏支持「+」打开新文件夹按钮

## 5. per-workspace 会话与编辑器状态

- [x] 5.1 失败测试: `SessionSidebar` 只显示 cwd 等于 active workspace path 的会话 (AC-6) → `src/renderer/src/components/sessions/SessionSidebar.test.tsx`
- [x] 5.2 实现: 修改 `SessionSidebar.tsx` 按 active workspace path 过滤会话
- [x] 5.3 实现: `workspaceStore.switch(id)` 恢复该工作区的 `activeSessionId` 和 `openFilePaths`
- [x] 5.4 实现: `editorStore.ts` 新增 `restoreFromPaths(paths: string[])`，按路径批量打开标签
- [x] 5.5 实现: `workspaceStore.close(id)` 关闭最后一个工作区且有脏标签时提示确认 (AC-7)

## 6. 回归验证

- [x] 6.1 运行 `npm run typecheck` — passed
- [x] 6.2 运行 `npm run test:main` — 19 files, 127 tests passed
- [x] 6.3 运行 `npm run test:renderer` — 26 files, 125 tests passed
- [x] 6.4 运行 `npm run test:e2e` — 4 files, 4 tests passed
- [x] 6.5 运行 `npm run pack` — passed
