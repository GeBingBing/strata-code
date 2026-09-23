# Tasks: native-menu

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 菜单注册

- [x] 1.1 失败测试: `createMenuTemplate` 返回 File/Edit/View/Window/Help 菜单结构 (AC-1) → `tests/main/menu.test.ts`
- [x] 1.2 实现: 在 `src/main/index.ts` 中调用 `Menu.setApplicationMenu`
- [x] 1.3 重构: 抽离 `src/main/menu.ts` 独立模块

## 2. 菜单事件通道

- [x] 2.1 失败测试: 点击 New Chat 菜单发送 `menu:new-chat` 事件 (AC-2) → `tests/main/menu.test.ts`
- [x] 2.2 失败测试: 点击 Open Workspace 菜单发送 `menu:open-workspace` 事件 (AC-3) → `tests/main/menu.test.ts`
- [x] 2.3 失败测试: Settings / Reload 菜单项发送对应事件 (AC-5/6) → `tests/main/menu.test.ts`
- [x] 2.4 实现: 在 `src/shared/ipc.ts` 新增 `menu:*` event channels

## 3. 渲染层响应

- [x] 3.1 实现: `App.tsx` 订阅 `menu:new-chat` → `sessionStore.newChat()`
- [x] 3.2 实现: `App.tsx` 订阅 `menu:open-workspace` → `configStore.pickWorkspace()`
- [x] 3.3 实现: `menu:open-settings` 先用 console.log placeholder（设置面板留给后续迭代）
- [x] 3.4 实现: `menu:reload` → `window.location.reload()`

## 4. 回归验证

- [x] 4.1 运行 `npm run test:main` — 8 files, 45 tests passed
- [x] 4.2 运行 `npm run test:renderer` — 14 files, 62 tests passed
- [x] 4.3 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 4.4 运行 `npm run typecheck` — passed
- [x] 4.5 运行 `npm run pack` — passed
