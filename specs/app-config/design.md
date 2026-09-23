# Design: app-config

## Context

实现 [requirements.md](./requirements.md)。当前 `main/index.ts` 的 `config:get` handler 返回硬编码值（`permissionMode: 'default'`、`model: 'default'`、`cwd: app.getPath('home')`），与 `AgentService` 真实状态脱节。本设计通过给 `AgentService` 增加 getter，并让 `config:get` 读取实时状态来消除硬编码。

## Data Flow / Architecture

```
启动:
  main/index.ts
    cwd = app.getPath('home')
    agentService = new AgentService({ cwd, permissionMode: 'default', ... })

运行时:
  用户点击 StatusBar 的 cwd 区域
    │
    ▼
  Renderer: invoke('workspace:pick')
    │
    ▼
  Main: dialog.showOpenDialog → 返回 path
    │
    ▼
  Renderer: configStore.setCwd(path)
    │
    ▼
  用户发送新消息 → agent:send
    │
    ▼
  Main: AgentService.start 使用 configStore 当前 cwd/model

状态查询:
  Renderer: invoke('config:get')
    │
    ▼
  Main: 读取 agentService.currentCwd / currentPermissionMode / currentModel / agentMode
```

## Contracts

```ts
// src/shared/types.ts
export interface AppConfig {
  /** 当前工作目录（AgentService 实际使用的 cwd） */
  cwd: string
  /** 当前权限模式 */
  permissionMode: PermissionMode
  /** 当前模型标识 */
  model: string
  /** 运行模式：real 调用真实 SDK；fake 使用 FakeAgent */
  agentMode: 'real' | 'fake'
}

// src/main/agent/AgentService.ts
export class AgentService {
  get currentSessionId(): string | null
  get isRunning(): boolean
  get currentCwd(): string
  get currentPermissionMode(): PermissionMode
  get currentModel(): string | null
  async setPermissionMode(mode: PermissionMode): Promise<void>
}

// src/shared/ipc.ts（已存在，语义如下）
'workspace:pick': () => Promise<string | null>
'config:get': () => Promise<AppConfig>
'agent:setPermissionMode': (p: { mode: PermissionMode }) => Promise<void>
```

## Edge Cases

- `AgentService` 未初始化时调用 `config:get` → 返回启动默认值（home cwd / default mode）。
- `setPermissionMode` 在查询未启动时调用 → 保留模式值，供下次 `start()` 使用。
- `setPermissionMode` 在查询运行中调用 → 透传给 `Query`，同时更新内部副本。
- 模型从 system `init` 消息捕获；若未收到 init（异常退出），返回 `null` 或默认值 `'default'`。
- fake 模式下 `currentModel` 固定返回 `'fake-model'`；`currentPermissionMode` 固定返回 `'default'`。

## Alternatives Considered

- **把配置状态存在主进程顶层变量**：简单，但无法与多个窗口/会话共享；AgentService 作为真实状态源更内聚。
- **每次状态变化主动推 `config:changed` 事件**：更实时，但增加通道复杂度；先采用拉取式 `config:get`，后续可扩展为事件推送。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/4 | `tests/main/agent/AgentService.test.ts` | 启动后 `currentCwd` 等于传入 cwd；`config:get` 返回真实值 |
| AC-4 | `tests/main/...` 或 E2E | `config:get` 不返回硬编码 `'default'` |
| AC-2/3 | `tests/e2e/config.spec.ts` | 选择目录后 `config:get.cwd` 更新；新会话使用新 cwd |
| AC-5 | `tests/main/agent/AgentService.test.ts` | `setPermissionMode` 后 `currentPermissionMode` 更新 |
| AC-6 | `tests/main/agent/AgentService.test.ts` | system init 捕获 model；`config:get.model` 非硬编码 |
| AC-7 | `tests/renderer/...` | 运行中禁用 cwd/model 切换按钮 |
