# Design: workspace-foundation

## Context

实现 [requirements.md](./requirements.md)。当前问题：

1. `WelcomePage` 已实现但 `App.tsx` 从未渲染它，启动后若 `cwd` 为空则主界面空白。
2. `FileService` 在 `src/main/index.ts` 构造时以 `app.getPath('home')` 作为 `root`，之后 `config:set` 切换 `cwd` 只改 `AgentService` 的 `cwd`，不改 `FileService.root`，导致切换后的工作目录中文件读取越界。
3. `menu:open-settings` 被 `App.tsx` 映射为 `setPaletteOpen(true)`，没有真正设置面板。
4. `SessionStore` 保存了 `cwd`，但 `sessionStore.open(id)` 只加载消息，不恢复 `cwd`。

## Data Flow / Architecture

```
启动:
  main/index.ts
    fileService = new FileService(app.getPath('home'))
    agentService = new AgentService({ cwd: app.getPath('home'), ... })

空状态:
  Renderer App.tsx
    configStore.loaded && !configStore.cwd
      → 渲染 <WelcomePage />
      → 用户点击「打开工作目录」
      → pickWorkspace() → switchWorkspace(path)

切换 cwd:
  Renderer: invoke('config:set', { cwd: path })
    │
    ▼
  Main: agentService.setCwd(path)
        fileService.setRoot(path)
        broadcast('workspace:changed', { cwd: path })

打开历史会话:
  Renderer sessionStore.open(id)
    │
    ▼
  从 sessions 找到 summary.cwd
  若 cwd 与当前不同:
    有脏标签 → 提示确认
    确认后 → configStore.switchWorkspace(cwd)
  加载 messages → chatStore.openSession(messages)

设置面板:
  menu:open-settings / Cmd+,
    │
    ▼
  App.tsx setSettingsOpen(true)
    │
    ▼
  <SettingsModal /> 渲染
    修改即时通过 configStore actions 生效
```

## Contracts

```ts
// src/main/files/fileService.ts
export class FileService {
  setRoot(root: string): void
}

// src/shared/ipc.ts
'workspace:changed': (p: { cwd: string }) => void

// src/renderer/src/App.tsx
const [settingsOpen, setSettingsOpen] = useState(false)
const showWelcome = loaded && !cwd
return (
  <>
    {showWelcome ? <WelcomePage /> : <AppShell />}
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    ...
  </>
)

// src/renderer/src/state/sessionStore.ts
open: async (id) => {
  const summary = get().sessions.find((s) => s.id === id)
  if (summary?.cwd && summary.cwd !== useConfigStore.getState().cwd) {
    await useConfigStore.getState().switchWorkspace(summary.cwd)
  }
  set({ activeId: id })
  const messages = await invoke('sessions:read', { id })
  useChatStore.getState().openSession(messages)
}
```

## Edge Cases

- `configStore.loaded` 为 false 时不渲染 WelcomePage，避免闪烁。
- `FileService.setRoot` 更新 root 后，所有后续 `guard()` 按新 root 计算；进行中的 IPC 调用不会交叉，因为 root 修改发生在 await 之间。
- `sessionStore.open` 遇到 `summary.cwd` 为空（旧数据）时跳过恢复，直接加载消息。
- 设置面板中切换 permissionMode 仍通过 `agent:setPermissionMode`；切换 model 仍通过 `config:set`。

## Alternatives Considered

- **在 `FileService` 构造新实例替换旧实例**：可行，但会破坏已有的引用；`setRoot` 更轻量且保持实例稳定。
- **把 workspace:changed 作为 config:set 的返回值**：事件更解耦，未来多窗口也能收到。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `src/renderer/src/App.test.tsx` | 未设置 cwd 时渲染 `welcome-page`；设置后渲染 `AppShell` |
| AC-2 | `tests/main/files/fileService.test.ts` | `setRoot` 后 `read` 新 root 内文件成功、旧 root 外文件失败 |
| AC-3 | `tests/main/...` | `config:set` cwd 后 `workspace:changed` 事件携带新 cwd |
| AC-4/5 | `src/renderer/src/App.test.tsx` | `menu:open-settings` 打开设置面板；面板内修改模型/主题 |
| AC-6/7 | `src/renderer/src/state/sessionStore.test.ts` | `open(id)` 调用 `switchWorkspace(summary.cwd)`；有脏标签时提示确认 |
