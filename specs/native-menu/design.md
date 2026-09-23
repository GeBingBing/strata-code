# Design: native-menu

## Context

实现 [requirements.md](./requirements.md)。当前 `main/index.ts` 未调用 `Menu.setApplicationMenu`，macOS 用户没有标准快捷键。本设计在应用启动后注册菜单，菜单项通过 IPC 向渲染进程发送事件或调用现有 action。

## Data Flow / Architecture

```
main/index.ts
    │
    ▼
Menu.buildFromTemplate([...])
    │
    ├─ New Chat   → mainWindow.webContents.send('menu:new-chat')
    ├─ Open Workspace → invoke('workspace:pick') 或 send('menu:open-workspace')
    ├─ Settings   → send('menu:open-settings')
    ├─ Copy/Paste → role: 'copy' / 'paste'
    └─ Reload     → role: 'reload'

Renderer:
    subscribe('menu:new-chat') → sessionStore.newChat()
    subscribe('menu:open-workspace') → configStore.pickWorkspace()
    subscribe('menu:open-settings') → configStore.openSettings()
```

## Contracts

```ts
// src/shared/ipc.ts EventChannels（新增）
'menu:new-chat': () => void
'menu:open-workspace': () => void
'menu:open-settings': () => void

// main/index.ts
function createMenuTemplate(win: BrowserWindow): MenuItemConstructorOptions[]
Menu.setApplicationMenu(Menu.buildFromTemplate(template))
```

## Edge Cases

- 多窗口时菜单应作用于当前焦点窗口。
- 无窗口时（macOS dock 点击）部分菜单项禁用。
- Windows/Linux 平台角色菜单行为可能略有差异，但不影响核心功能。

## Alternatives Considered

- **不注册原生菜单，仅依赖 UI 按钮**：当前现状，但不符合桌面应用习惯，且缺少快捷键。
- **所有菜单项直接调用主进程内部函数**：会导致菜单与渲染状态不一致；通过 IPC 事件让渲染层处理更合理。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | E2E / 手动 | 启动后菜单栏存在 File/Edit/View/Help |
| AC-2 | `tests/e2e/sessions.spec.ts` 或新增 `native-menu.spec.ts` | Cmd+Shift+N 后 activeId 为 null、chat 重置 |
| AC-3 | E2E | Cmd+Shift+O 触发目录选择对话框 |
| AC-4 | E2E | 复制粘贴文本正常 |
| AC-5 | E2E | Cmd+R 重新加载窗口 |
| AC-6 | E2E | Cmd+, 触发 settings 事件 |
