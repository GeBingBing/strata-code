# Tasks: session-search-and-grouping

> 约定：每项 ≤1 天；TDD 顺序 = 先写失败测试（标注测试文件），再实现使其变绿；完成后勾选。
> tasks.md 是进度的唯一事实源。

## 1. 搜索过滤

- [x] 1.1 失败测试: `SessionSidebar` 渲染搜索框 (AC-1) → `src/renderer/src/components/sessions/SessionSidebar.test.tsx`
- [x] 1.2 失败测试: 输入搜索文本后按标题过滤 (AC-2) → 同上
- [x] 1.3 失败测试: 过滤结果为空显示「无匹配会话」 (AC-3) → 同上
- [x] 1.4 实现: `SessionSidebar` 本地 `query` state + 过滤逻辑

## 2. 时间分组

- [x] 2.1 失败测试: `groupByDate` 将 today/yesterday/earlier 分开 (AC-4/5) → 同上
- [x] 2.2 实现: `groupByDate` 辅助函数与分组渲染
- [x] 2.3 实现: 样式 `.session-group` / `.session-group-label` / `.session-search`

## 3. 回归验证

- [x] 3.1 运行 `npm run test:renderer` — 15 files, 65 tests passed
- [x] 3.2 运行 `npm run test:main` — 8 files, 45 tests passed
- [x] 3.3 运行 `npm run test:e2e` — 2 files, 2 tests passed
- [x] 3.4 运行 `npm run typecheck` — passed
- [x] 3.5 运行 `npm run pack` — passed
