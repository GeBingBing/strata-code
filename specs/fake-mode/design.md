# Design: fake-mode

## Context

实现 [requirements.md](./requirements.md)。fake 模式是应用的"离线替身"，通过替换 `QueryFactory` 实现，让 `AgentService` 无需感知自己运行的是 fake 还是真实 SDK。

## Data Flow / Architecture

```
main/index.ts
  │
  ├─ isFakeMode() ? createFakeQueryFactory() : sdkQuery
  │
  ▼
AgentService.start(firstText)
  │
  ▼
FakeAgent Query
  │
  ├─ yield system(init)    → model='fake-model', cwd=process.cwd()
  ├─ yield partial text    → "Echo: {userText[:20]}"
  ├─ yield partial text    → " …done."
  ├─ yield assistant(text) → 完整回显
  ├─ yield assistant(tool_use: Read) → {file_path: '/tmp/example.txt'}
  ├─ yield user(tool_result)         → 'file content here'
  └─ yield result(success) → total_cost_usd=0.001
```

## Contracts

```ts
// src/main/agent/FakeAgent.ts
export function createFakeQueryFactory(): QueryFactory

// src/main/index.ts
const isFakeMode = (): boolean => process.env.APP_AGENT_MODE === 'fake'

const queryFactory: QueryFactory = isFakeMode()
  ? createFakeQueryFactory()
  : (params) => sdkQuery(params)

// src/shared/types.ts
interface AppConfig {
  agentMode: 'real' | 'fake'
  // ...
}
```

## Edge Cases

- `prompt` 迭代器未被完全排空：fake 脚本在产出 `result` 后立即结束生成器，`consume()` 循环正常回到 idle（FakeAgent.ts 注释已说明）。
- `APP_AGENT_MODE` 设置为大写或带空格 → 严格等于 `'fake'`，否则视为 real。
- fake 模式下调用 `setPermissionMode`：当前实现透传给 `Query`，fake Query 无实际处理，属 no-op；不抛异常。
- fake 模式下 `canUseTool` 仍走 `PermissionBridge`，因此权限对话框流程与真实模式一致。

## Alternatives Considered

- **用 Vitest mock 替换 SDK**：对单元测试足够，但无法支持 E2E 与手动离线体验；fake factory 同时覆盖三层测试场景。
- **让 fake agent 完全随机回显**：不可复现，不利于 E2E 断言；固定脚本是更优折中。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/3 | `tests/main/agent/FakeAgent.test.ts` | fake factory 产出固定消息序列；包含 system/init、partial、assistant、tool_use、tool_result、result |
| AC-2 | `tests/main/agent/AgentService.test.ts` | fake 模式注入后，真实 SDK `query` 不被调用 |
| AC-4 | `tests/e2e/chat.spec.ts` | E2E 在 fake 模式下验证流式回复与工具卡片 |
| AC-5 | `tests/e2e/chat.spec.ts` 或 `tests/main/...` | `config:get` 返回 `agentMode: 'fake'` |
