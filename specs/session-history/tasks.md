# Tasks: session-history

## 1. SessionStore（TDD）

- [x] 1.1 失败测试: upsert 创建/更新、list 按 updatedAt 降序 (AC-1/2/3) → `tests/main/sessions/SessionStore.test.ts`
- [x] 1.2 失败测试: rename/delete (AC-5) → 同上
- [x] 1.3 失败测试: 损坏 JSON → 空列表不抛 (AC-6) → 同上
- [x] 1.4 失败测试: 原子写 tmp+rename (AC-7) → 同上
- [x] 1.5 实现 `src/main/sessions/SessionStore.ts` + titleFromFirstMessage

## 2. IPC 与集成

- [x] 2.1 注册 sessions:list/read/rename/delete handlers（read 包装 SDK getSessionMessages，失败返回空）
- [x] 2.2 AgentService 捕获 session id 时 upsert 索引（onSessionStart 回调）
- [x] 2.3 渲染端 sessionStore(zustand) + SessionSidebar（列表/删除/打开/新对话）
- [x] 2.4 恢复链路：open → sessions:read 回放 + 后续 send 带 resume（AgentService.switchSession）
- [x] 2.5 E2E: fake 模式会话创建与侧栏刷新/删除 → `tests/e2e/sessions.spec.ts` ✓（新增 sessionStore.connect 订阅 agent:status 自动刷新列表）
