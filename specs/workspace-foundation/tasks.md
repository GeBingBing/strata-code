> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: workspace-foundation

## 1. FileService root 可跟随 cwd

- [x] 1.1 失败测试: `FileService.setRoot` 后读取新 root 内文件成功、旧 root 外文件越界失败 (AC-2) → `tests/main/files/fileService.test.ts`
- [x] 1.2 实现: 在 `src/main/files/fileService.ts` 增加 `setRoot(root: string)`，保留 `guard()` 按当前 root 校验
- [x] 1.3 重构: 确保所有方法通过 `this.root` 间接使用 root，禁止方法内缓存 root 副本

## 2. IPC workspace:changed 与主进程根跟随

- [x] 2.1 失败测试: `config:set` 切换 cwd 后，`fileService` 能读取新目录文件；`workspace:changed` 事件被广播 (AC-2/3) → 新增 `tests/main/workspace.test.ts`
- [x] 2.2 实现: `src/shared/ipc.ts` 新增 `workspace:changed` 事件；`src/main/index.ts` 在 `config:set` handler 中调用 `fileService.setRoot(cwd)` 并广播事件
- [x] 2.3 重构: 同步修复 `onSessionStart` 记录 `agentService.currentCwd` 而非启动时固定的 home cwd

## 3. 空状态渲染 WelcomePage

- [x] 3.1 失败测试: `configStore.loaded` 为 true 且 `cwd` 为空时渲染 `welcome-page`；有 cwd 时渲染 `AppShell` (AC-1) → `src/renderer/src/App.test.tsx`
- [x] 3.2 实现: `src/renderer/src/App.tsx` 根据 `loaded && !cwd` 条件渲染 `WelcomePage` 或 `AppShell`
- [x] 3.3 重构: 未加载完成时渲染 `null`，避免 WelcomePage/AppShell 闪烁

## 4. 真正的 Settings 面板

- [x] 4.1 失败测试: `menu:open-settings` 打开 `settings-modal`；面板中修改 theme/fontSize 能触发对应 actions (AC-4/5) → `src/renderer/src/App.test.tsx`、`src/renderer/src/components/settings/SettingsModal.test.tsx`
- [x] 4.2 实现: 新增 `src/renderer/src/components/settings/SettingsModal.tsx`（Editor/Agent/About 三节）
- [x] 4.3 实现: `src/renderer/src/App.tsx` 增加 `settingsOpen` 状态，`menu:open-settings` 打开设置面板
- [x] 4.4 实现: `src/renderer/src/lib/registerCommands.ts` 增加 `app.openSettings` 命令
- [x] 4.5 重构: SettingsModal 使用现有 `PermissionModeSelector`、`ModelSelector` 组件，避免重复实现

## 5. 打开历史会话恢复 cwd

- [x] 5.1 失败测试: `sessionStore.open(id)` 在 `summary.cwd` 与当前 cwd 不同时调用 `switchWorkspace(summary.cwd)`；cwd 为空时跳过 (AC-6) → `src/renderer/src/state/sessionStore.test.ts`
- [x] 5.2 实现: 修改 `src/renderer/src/state/sessionStore.ts` 的 `open` 方法，先恢复 cwd 再加载消息
- [x] 5.3 实现: 若当前有脏标签且 cwd 将变化，使用 `window.confirm` 提示用户确认 (AC-7)

## 6. 回归验证

- [x] 6.1 运行 `npm run typecheck` — passed
- [x] 6.2 运行 `npm run test:main` — 18 files, 115 tests passed
- [x] 6.3 运行 `npm run test:renderer` — 24 files, 113 tests passed
- [x] 6.4 运行 `npm run test:e2e` — 4 files, 4 tests passed
- [x] 6.5 运行 `npm run pack` — passed（首次因网络下载 Electron 超时失败，重试后成功生成 `release/mac/Claude SDK Agent.app`）
