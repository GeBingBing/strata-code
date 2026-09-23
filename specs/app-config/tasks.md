# Tasks: app-config

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. AgentService 状态 getter

- [x] 1.1 失败测试: `AgentService.currentCwd` 返回构造时传入的 cwd；`currentPermissionMode` 反映初始值与 `setPermissionMode` 后的值；`currentModel` 从 system init 消息捕获 (AC-1/4/5/6) → `tests/main/agent/AgentService.test.ts`
- [x] 1.2 实现: 在 `AgentService` 中新增 `currentCwd`、`currentPermissionMode`、`currentModel` getter；`setPermissionMode` 同步写内部副本
- [x] 1.3 重构: 确保 getter 不依赖未初始化的 query，dispose 后仍可安全读取

## 2. 消除 config:get 硬编码

- [x] 2.1 失败测试: `config:get` handler 返回 `agentService.currentCwd` / `currentPermissionMode` / `currentModel`，而非字面量 `'default'` (AC-4) → `tests/main/...`（可新增 `tests/main/config.test.ts` 或并入 `AgentService.test.ts`）
- [x] 2.2 实现: 修改 `src/main/index.ts` 的 `config:get` handler，读取 AgentService getter
- [x] 2.3 重构: `AppConfig` 组装逻辑内联在 handler 中，保持简洁

## 3. 工作目录选择器

- [x] 3.1 实现: `src/main/index.ts` 注册 `workspace:pick` handler，调用 `dialog.showOpenDialog` (AC-2)
- [x] 3.2 失败测试: 渲染层 `ConfigStore` / `StatusBar` 正确显示 cwd 并触发 `workspace:pick` (AC-2/3) → `src/renderer/src/state/configStore.test.ts`、`src/renderer/src/components/chat/StatusBar.test.tsx`
- [x] 3.3 实现: 新增 `useConfigStore`；扩展 `StatusBar` 显示 cwd（可点击）
- [x] 3.4 E2E: `tests/e2e/config.spec.ts` 验证选择目录后 `config:get` 返回新 cwd（可选，组件/状态测试已覆盖） → 通过 `window.api.invoke('config:set', { cwd })` 模拟选择（避开 Playwright 无法拦截原生 dialog），断言 status-cwd 与 config:get 同步刷新

## 4. 权限模式切换器

- [x] 4.1 实现: `src/main/index.ts` 注册 `agent:setPermissionMode` handler (AC-5)
- [x] 4.2 失败测试: `PermissionModeSelector` 渲染当前模式并切换 (AC-5) → `src/renderer/src/components/chat/PermissionModeSelector.test.tsx`
- [x] 4.3 实现: 在 ChatView 上方工具栏新增 `PermissionModeSelector`
- [x] 4.4 重构: 切换后 ConfigStore 立即更新，无需额外刷新

## 5. 模型选择器

- [x] 5.1 失败测试: `ModelSelector` 渲染当前模型并切换；切换后 `config:get.model` 更新 (AC-6) → `src/renderer/src/components/chat/ModelSelector.test.tsx`
- [x] 5.2 实现: 新增 `ModelSelector`；切换后写入 `ConfigStore.model`，并在 `AgentService.start()` 时透传给 SDK `Options.model`
- [x] 5.3 重构: fake 模式下 `ModelSelector` 禁用并显示 `'fake-model'`

## 6. 运行中禁用策略

- [x] 6.1 失败测试: agent running 时，cwd 与 model 切换按钮被禁用 (AC-7) → `src/renderer/src/components/AppShell.test.tsx`、`StatusBar.test.tsx`、`PermissionModeSelector.test.tsx`、`ModelSelector.test.tsx`
- [x] 6.2 实现: `AppShell` 根据 `useChatStore.status` 向选择器传递 `disabled`；`StatusBar` 按钮自带 disabled

## 7. 回归验证

- [x] 7.1 运行 `npm run test:main` — 7 files, 42 tests passed
- [x] 7.2 运行 `npm run test:renderer` — 10 files, 43 tests passed
- [x] 7.3 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 7.4 运行 `npm run typecheck` — passed
