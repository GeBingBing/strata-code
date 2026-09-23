> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

# Tasks: sidebar-registry

## 1. 侧边栏面板注册机制

- [x] 1.1 失败测试: `registerPanel` 注册面板；`getPanels` 返回有序列表；返回的卸载函数移除面板 (AC-1) → `src/renderer/src/lib/sidebarRegistry.test.ts`
- [x] 1.2 实现: 新增 `src/renderer/src/lib/sidebarRegistry.ts`
- [x] 1.3 重构: `sidebarStore.tab` 类型改为 `string`，默认 `'files'`
- [x] 1.4 实现: `AppShell.tsx` 改为从 registry 渲染 ActivityBar 与 sidebar 内容
- [x] 1.5 重构: `ActivityBar.tsx` 接收 `panels: SidebarPanel[]`，按 id 渲染

## 2. 内置面板注册

- [x] 2.1 实现: 在 `App.tsx` 启动时注册 Files / Sessions / Search / Memory / Git 五个内置面板 (AC-1)
- [x] 2.2 实现: `src/renderer/src/components/icons.tsx` 增加 `SearchIcon` / `BrainIcon` / `GitIcon`
- [x] 2.3 重构: 把 Files 与 Sessions 面板迁出 AppShell 内联，转为独立组件

## 3. Search 面板

- [x] 3.1 失败测试: `SearchService.search(root, query)` 在 fixture 文件中匹配并返回 preview (AC-5) → `tests/main/search.test.ts`
- [x] 3.2 实现: `src/main/search/searchService.ts` —— 优先 ripgrep，降级为 node 遍历
- [x] 3.3 失败测试: `SearchPanel` 输入查询、调用 IPC、渲染结果 → `src/renderer/src/components/sidebar/SearchPanel.test.tsx`
- [x] 3.4 实现: `src/renderer/src/components/sidebar/SearchPanel.tsx`
- [x] 3.5 实现: `src/main/index.ts` 注册 `search:files` handler

## 4. Git 面板

- [x] 4.1 失败测试: `GitService.status(cwd)` 在非 git 目录返回空 status 不抛错 (AC-6) → `tests/main/git.test.ts`
- [x] 4.2 失败测试: `GitService.log` 解析 `git log --pretty=format:%h%s` 输出 → `tests/main/git.test.ts`
- [x] 4.3 实现: `src/main/git/gitService.ts`
- [x] 4.4 失败测试: `GitPanel` 渲染 status / 文件列表 / 最近 commit → `src/renderer/src/components/sidebar/GitPanel.test.tsx`
- [x] 4.5 实现: `src/renderer/src/components/sidebar/GitPanel.tsx`
- [x] 4.6 实现: `src/main/index.ts` 注册 `git:status/diff/log` handler

## 5. Memory 面板

- [x] 5.1 失败测试: `MemoryPanel` 调用 memory:list 渲染记忆条目，点击删除调用 memory:delete (AC-7) → `src/renderer/src/components/sidebar/MemoryPanel.test.tsx`
- [x] 5.2 实现: `src/renderer/src/components/sidebar/MemoryPanel.tsx`，按 scope 分组
- [x] 5.3 实现: 删除前 `window.confirm` 确认

## 6. 回归验证

- [x] 6.1 运行 `npm run typecheck` — passed
- [x] 6.2 运行 `npm run test:main` — 22 files, 140 tests passed
- [x] 6.3 运行 `npm run test:renderer` — 31 files, 146 tests passed
- [x] 6.4 运行 `npm run test:e2e` — 4 files, 4 tests passed
- [x] 6.5 运行 `npm run pack` — passed
