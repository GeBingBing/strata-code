# Design: workspace-management

## Context

实现 [requirements.md](./requirements.md)。当前 `cwd` 是全局的，`recentWorkspaces` 只存在 localStorage。本设计引入主进程 `WorkspaceStore`（`userData/workspaces.json`）和渲染层 `workspaceStore`，把工作区变为持久化、可切换、可恢复状态的一等对象。

## Data Flow / Architecture

```
持久化层 (main):
  WorkspaceStore —— userData/workspaces.json
  {
    openWorkspaceIds: string[],
    activeWorkspaceId: string | null,
    workspaces: Workspace[]
  }

  打开文件夹:
    workspace:pick → path
    WorkspaceStore.upsert(path) → workspace
    WorkspaceStore.addOpen(workspace.id)
    → 返回 Workspace + current view state

  切换工作区:
    workspace:switch { id }
    WorkspaceStore.setActive(id)
    → 返回 WorkspaceViewState

  关闭工作区:
    workspace:close { id }
    WorkspaceStore.removeOpen(id)
    若关闭的是 active → 自动选择上一个活跃工作区
    → 返回 { activeWorkspaceId, nextState? }

  保存视图状态:
    workspace:updateState { id, state }
    WorkspaceStore.updateState(id, state)

渲染层 (renderer):
  workspaceStore:
    - workspaces: Workspace[]
    - openIds: string[]
    - activeId: string | null
    - load() / open(path) / switch(id) / close(id) / updateState()

  打开文件夹:
    调用 workspace:open → 更新 workspaceStore
    → configStore.switchWorkspace(path) 同步 cwd
    → sessionStore 加载该 cwd 的会话
    → editorStore 恢复 openFilePaths

  切换标签:
    先保存当前工作区状态
    → workspaceStore.switch(id)
    → configStore.switchWorkspace(path)
    → 恢复 activeSessionId + open tabs

  SessionSidebar:
    只渲染 cwd === activeWorkspace.path 的会话
```

## Contracts

```ts
// src/shared/types.ts
export interface Workspace {
  id: string           // path 的 stable hash
  path: string
  name: string         // basename(path)
  lastOpenedAt: number
}

export interface WorkspaceViewState {
  activeSessionId?: string
  openFilePaths?: string[]
  sidebarTab?: string
  chatInputDraft?: string
}

// src/shared/ipc.ts
'workspace:list': () => Promise<{ workspaces: Workspace[]; openIds: string[]; activeId: string | null }>
'workspace:open': (p: { path: string }) => Promise<Workspace>
'workspace:close': (p: { id: string }) => Promise<{ activeId: string | null }>
'workspace:switch': (p: { id: string }) => Promise<WorkspaceViewState>
'workspace:updateState': (p: { id: string; state: Partial<WorkspaceViewState> }) => Promise<void>

// src/main/workspace/WorkspaceStore.ts
export class WorkspaceStore {
  constructor(filePath: string)
  async list(): Promise<{ workspaces: Workspace[]; openIds: string[]; activeId: string | null }>
  async upsert(path: string): Promise<Workspace>
  async addOpen(id: string): Promise<void>
  async removeOpen(id: string): Promise<void>
  async setActive(id: string | null): Promise<void>
  async updateState(id: string, state: Partial<WorkspaceViewState>): Promise<void>
  async getState(id: string): Promise<WorkspaceViewState>
}

// src/renderer/src/state/workspaceStore.ts
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  openIds: [],
  activeId: null,
  loaded: false,
  load: async () => { ... },
  open: async (path) => { ... },
  switch: async (id) => { ... },
  close: async (id) => { ... },
  updateState: async (state) => { ... }
}))
```

## Edge Cases

- 文件夹已被打开 → `upsert` 返回已有 workspace，`addOpen` 幂等，切换到该工作区。
- 文件夹不存在或不可访问 → 保留 workspace 记录但标记失效？Phase 2 简单处理：切换时由 `configStore.switchWorkspace` 负责报错并从 recent 移除。
- 关闭唯一工作区 → activeId 为 null，App 渲染 WelcomePage。
- 启动无持久化工作区 → 与 Phase 1 行为一致，显示 WelcomePage。
- 工作区关闭时若该 workspace 有脏标签 → `window.confirm` 提示。

## Alternatives Considered

- **把 workspaces 存到 userData/settings.json 与 AppConfig 合并**：配置与工作区职责不同，分离更清晰，也方便后续多窗口共享。
- **每个工作区一个 JSON 文件**：过度设计；当前数据量小，单文件足够。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `tests/main/workspace/WorkspaceStore.test.ts` | `upsert` 创建/复用 workspace；`addOpen` 加入打开列表 |
| AC-2/4 | `src/renderer/src/state/workspaceStore.test.ts` | `switch` 调用 `workspace:switch` 并恢复 view state |
| AC-3 | `src/renderer/src/components/workspace/WorkspaceTabs.test.tsx` | 关闭标签触发 `workspace:close`；最后一个关闭后无 active |
| AC-5 | `tests/main/workspace/WorkspaceStore.test.ts` | 持久化后重新加载恢复 openIds/activeId |
| AC-6 | `src/renderer/src/components/sessions/SessionSidebar.test.tsx` | 只显示匹配 cwd 的会话 |
| AC-7 | `src/renderer/src/components/workspace/WorkspaceTabs.test.tsx` | 关闭唯一工作区且有脏标签时确认 |
