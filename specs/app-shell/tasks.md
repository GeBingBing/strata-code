# Tasks: app-shell

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. 脚手架与测试基座

- [x] 1.1 手写 electron-vite 工程配置（package.json / electron.vite.config.ts / tsconfig×3 / vitest×3 / electron-builder.yml）
- [x] 1.2 `npm install` + 依赖验证（需 Node ≥22，用 nvm v24.16.0；vite 降 7 / plugin-react 降 5 解决 peer 冲突）
- [x] 1.3 双 Vitest 配置冒烟（main 32 用例 + renderer 25 用例全绿）
- [x] 1.4 Electron 启动验证（E2E `_electron.launch` 打开窗口）

## 2. IPC 契约（TDD）

- [x] 2.1 失败测试: typedHandle 注册与调用、未注册通道 reject、handler 异常回传 (AC-1/3/4) → `tests/main/ipc.test.ts`
- [x] 2.2 失败测试: 事件订阅/取消订阅 (AC-2) → `tests/main/ipc.test.ts`
- [x] 2.3 实现 `src/shared/ipc.ts`（InvokeChannels/EventChannels 接口 + 泛型推导）
- [x] 2.4 实现主进程 `src/main/ipc.ts` handleInvoke/sendEvent 与渲染进程 `src/renderer/src/ipc/client.ts`
- [x] 2.5 preload `contextBridge` 暴露 `window.api`（invoke/on/off，ESM preload → sandbox: false）
- [x] 2.6 全部测试跑绿 + typecheck 干净

## 3. 应用窗口

- [x] 3.1 主窗口创建（contextIsolation: true, nodeIntegration: false, sandbox: false for ESM preload）
- [x] 3.2 生命周期：window-all-closed → quit（macOS 除外）；before-quit → denyAll + dispose
- [x] 3.3 打包产物验证（release/mac/*.app fake 模式运行 + asarUnpack SDK 生效）
