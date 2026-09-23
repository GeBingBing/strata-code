# Design: session-history

## Context

实现 [requirements.md](./requirements.md)。索引与转录分离：索引自管（~60 行 JSON 读写），转录交给 SDK。

## Data Flow / Architecture

```
AgentService (session id 捕获) ─► SessionStore.upsert()
sessions:list/read/rename/delete ◄─ typedHandle ─ Renderer SessionSidebar
resume: AgentService.start({resume: id}) + sessions:read 回放历史
```

## Contracts

```ts
type SessionSummary = { id: string; title: string; cwd: string;
                        createdAt: number; updatedAt: number }
// invoke 通道
'sessions:list':   () => Promise<SessionSummary[]>
'sessions:read':   (p: { id: string }) => Promise<UiMessage[]>   // 包装 SDK getSessionMessages
'sessions:rename': (p: { id: string; title: string }) => Promise<void>
'sessions:delete': (p: { id: string }) => Promise<void>

class SessionStore {
  constructor(filePath: string)
  list(): Promise<SessionSummary[]>
  upsert(s: SessionSummary): Promise<void>          // AC-1/2
  rename(id, title): Promise<void>
  delete(id): Promise<void>
}
```

## Edge Cases

- 原子写：`tmp 文件 + fs.rename`（AC-7）。
- 损坏 JSON → 捕获解析错误 → 返回空列表 + 重置文件（AC-6）。
- resume 的会话 id 不存在于 SDK 转录 → SDK 报错 → agent:error 传达，索引条目保留。

## Alternatives Considered

- **electron-store**: v9+ ESM-only、多一个依赖换 ~60 行代码 — 否决。
- **SQLite（better-sqlite3）**: 为几十条记录引入原生模块与 rebuild 麻烦 — 否决。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2/3 | `tests/main/sessions/SessionStore.test.ts` | upsert/list 排序/updatedAt |
| AC-5 | 同上 | rename/delete |
| AC-6 | 同上 | 损坏 JSON → 空列表不抛 |
| AC-7 | 同上 | 写入产生 tmp+rename（观察文件系统行为） |
| AC-4 | `tests/e2e/sessions.spec.ts` | fake 模式：新会话→出现侧栏→重开→恢复 |
