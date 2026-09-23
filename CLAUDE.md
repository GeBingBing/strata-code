# CLAUDE.md

基于 Claude Agent SDK 的桌面 AI 编程助手（类 Cursor/Codex）。Electron + React + TypeScript。

## 开发方法论（严格遵守）

**SDD（规格驱动）**：每个功能在 `specs/<feature>/` 下依次产出 requirements.md（EARS 验收标准）→ design.md（契约与测试策略）→ tasks.md（可勾选任务）。**tasks.md 是进度唯一事实源** —— 完成任务即勾选。新需求从 requirements 重新进入流程。

**TDD（红-绿-重构）**：先写失败测试（tasks.md 中标注了目标测试文件），再实现使其变绿，然后重构。不写无测试的实现。

## 常用命令

```bash
npm run dev              # 开发模式（scripts/dev.mjs 监听 src/main/preload/shared，文件改动自动 kill+respawn Electron；渲染层 HMR）
npm run dev:norestart    # 不自动重启，纯 electron-vite dev
npm test                 # 全部单测（main node 环境 + renderer jsdom）
npm run test:main        # 仅主进程/共享层测试
npm run test:renderer    # 仅渲染层测试
npm run test:e2e         # Playwright Electron E2E（fake 模式，零网络）
npm run typecheck        # 双 tsconfig 类型检查
npm run pack             # 打包（验证 asarUnpack 后 SDK 可用）
```

## 架构速览

```
Renderer (React/zustand)  ←typed IPC→  Main (AgentService → claude-agent-sdk query())
```

- **IPC 契约单一事实源**：`src/shared/ipc.ts`（invokeChannels/eventChannels 常量表）。新增通道必须改这里。
- **AgentService**（`src/main/agent/`）：每会话一个流式查询；`PromptQueue` 实现 AsyncIterable 输入（interrupt/setPermissionMode 中途可用的前提）；每条 SDKMessage 以 `{sessionId, seq, message}` 信封发 `agent:message`。
- **PermissionBridge**：canUseTool ↔ 渲染进程对话框的异步桥。防悬挂三件套：deny-on-abort / deny-on-window-destroyed / respond 幂等。**改动它必须先跑 tests/main/agent/PermissionBridge.test.ts**。
- **记忆子系统**（`src/main/memory/`，specs/memory-*）：混合式三层 —— ①`MemoryStore`（userData/memory.json，临界区串行化）+ `merge.ts` 纯函数巩固；②`MemoryInjector` 回合启动时召回注入 `systemPrompt.append`（**不设 snapshot**，每次启动新渲染）并发 `memory:recalled`；③`MemoryDistiller` 会话后蒸馏 harness 子循环（一次性侧查询 `maxTurns:1`，与主会话物理隔离，失败绝不打扰主循环）。`APP_MEMORY_ENABLED=0` 总开关。改记忆先跑 `npm run test:main -- tests/main/memory`。
- **harness 接缝**（AgentServiceOptions）：`buildSystemPromptAppend` / `onRunComplete` / `settingSources` 均记忆无关，memory 模块作为插件接入；`start()` 为 async（pendingStart 重入守卫——append 解析期间的新 send 进同一输入流）。
- **SDK 必须保持 externalized**（electron.vite.config.ts 的 externalizeDepsPlugin）—— 打包会破坏原生二进制解析。asarUnpack 已在 electron-builder.yml 配置。
- **fake 模式**：`APP_AGENT_MODE=fake` 时用 FakeAgent（确定性回显 + 模拟工具调用 + memory_recall）与 FakeDistiller（固定 JSON 提案），E2E 与离线开发零网络。
- **SDK mock**：单测一律 mock `@anthropic-ai/claude-agent-sdk`（真实 SDK 拉子进程）—— 用 tests/mocks/sdk.ts 的 createMockQuery。

## 渲染层约定

- 状态：zustand（`src/renderer/src/state/`）。核心逻辑在纯 reducer `lib/applySdkMessage.ts` —— UI 逻辑改动先改它的测试。
- 组件保持薄；所有 data-testid 前缀：`message-*`、`tool-card-*`、`permission-*`、`diff-*`、`memory-*`。
- 记忆召回双路径收敛到 `UiItem {kind:'memory'}`（sdk 的 memory_recall 与 app 的 memory:recalled 事件）；**新增 UiItem kind 必须同时改**：applySdkMessage reducer、MessageItem、AssistantTurn（否则被静默丢弃）、sessionExport（穷尽 switch 强制）。

## 测试环境

- main：node 环境，fake WebContents/IpcMain 注入（见各测试文件顶部工厂函数）
- renderer：jsdom + Testing Library，`setIpcOverride()` 注入 IPC 替身
- e2e：Playwright `_electron.launch` 启动 out/main/index.js
