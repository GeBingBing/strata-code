# Design: sidebar-registry

## Context

实现 [requirements.md](./requirements.md)。当前 ActivityBar 仅支持 Files / Sessions 两个面板，hardcoded 在 `AppShell.tsx` 与 `sidebarStore.ts`。本设计改为可注册面板机制，新增 Search / Memory / Git 三个面板。

## Data Flow / Architecture

```
面板注册 (App 启动):
  filesPanel   = registerPanel({ id: 'files', title: '文件', icon: FileIcon, component: FilesPanel })
  sessionsPanel= registerPanel({ id: 'sessions', title: '会话', icon: ChatIcon, component: SessionsPanel })
  searchPanel  = registerPanel({ id: 'search', title: '搜索', icon: SearchIcon, component: SearchPanel })
  memoryPanel  = registerPanel({ id: 'memory', title: '记忆', icon: BrainIcon, component: MemoryPanel })
  gitPanel     = registerPanel({ id: 'git', title: 'Git', icon: GitIcon, component: GitPanel })

渲染:
  ActivityBar: getPanels().map(panel => <button data-testid={`activity-${panel.id}`} ... />)
  AppShell sidebar: getPanels().find(p => p.id === activeTab)?.component

SearchPanel:
  input: invoke('search:files', { path: cwd, query })
  渲染结果列表 → 点击 invoke('file:read', { path })

GitPanel:
  加载: invoke('git:status', { path: cwd }) → { files, branch }
  invoke('git:log', { path: cwd, limit: 10 }) → commits[]
  文件 diff: invoke('git:diff', { path: cwd, file: path }) → unified diff

MemoryPanel:
  加载: invoke('memory:list') → 全局记忆
  invoke('memory:list') + filter cwd === active workspace.path → 项目记忆
  删除: invoke('memory:delete', { id })
```

## Contracts

```ts
// src/renderer/src/lib/sidebarRegistry.ts
export interface SidebarPanel {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType
  order?: number
}
export function registerPanel(panel: SidebarPanel): () => void
export function getPanels(): SidebarPanel[]

// src/shared/types.ts
export interface SearchResult { path: string; line: number; preview: string }
export interface GitStatus { branch: string; files: Array<{ path: string; status: 'M'|'A'|'D'|'?'|'R' }> }
export interface GitCommit { sha: string; message: string; date: number }

// src/shared/ipc.ts
'search:files': (p: { path: string; query: string }) => Promise<SearchResult[]>
'git:status': (p: { path: string }) => Promise<GitStatus>
'git:diff': (p: { path: string; file?: string }) => Promise<string>
'git:log': (p: { path: string; limit?: number }) => Promise<GitCommit[]>

// src/main/search/searchService.ts
export class SearchService {
  search(root: string, query: string): Promise<SearchResult[]>
}

// src/main/git/gitService.ts
export class GitService {
  status(cwd: string): Promise<GitStatus>
  diff(cwd: string, file?: string): Promise<string>
  log(cwd: string, limit?: number): Promise<GitCommit[]>
}
```

## Edge Cases

- 工作区不是 git 仓库 → `git:status` 返回 `{ branch: '', files: [] }` 而不抛错。
- ripgrep 不可用 → fallback 到 node 文件遍历（跳过二进制）。
- 工作区未设置 → 面板显示空状态 + 提示设置工作区。
- 面板内部 fetch 失败 → 显示错误信息而不崩溃其他面板。

## Alternatives Considered

- **每个面板订阅所有 IPC 事件**：笨重；面板主动 invoke 更可控。
- **面板注册到 main 进程**：注册机制可以保留在渲染层（main 不需要感知具体面板），IPC 契约统一即可。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | `src/renderer/src/lib/sidebarRegistry.test.ts` | 注册 / 反注册 / 排序 |
| AC-2 | `src/renderer/src/components/ActivityBar.test.tsx` | 渲染注册的面板并切换 |
| AC-5 | `tests/main/search.test.ts` + `src/renderer/src/components/sidebar/SearchPanel.test.tsx` | 搜索结果正确渲染 |
| AC-6 | `tests/main/git.test.ts` + `src/renderer/src/components/sidebar/GitPanel.test.tsx` | git status/diff/log 在非 git 目录返回空而不抛错 |
| AC-7 | `src/renderer/src/components/sidebar/MemoryPanel.test.tsx` | memory:list 渲染 + 删除 |
