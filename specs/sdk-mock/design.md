# Design: sdk-mock

## Context

实现 [requirements.md](./requirements.md)。`tests/mocks/sdk.ts` 的 `createMockQuery` 是主进程测试的核心依赖。本设计将其接口与行为契约化，确保后续修改 mock 时不破坏 `AgentService.test.ts` 等测试。

## Data Flow / Architecture

```
Test:
  const mock = createMockQuery([initMsg, resultMsg])
  const service = new AgentService(win, mock.factory, options)
  await service.send('hi')

Mock Factory:
  1. 保存 options → lastOptions
  2. 消费 prompt AsyncIterable → 记录到 receivedInputs
  3. 返回 AsyncGenerator，按 script 产出 SDKMessage
  4. 暴露 interrupt / setPermissionMode / setModel spy
```

## Contracts

```ts
// tests/mocks/sdk.ts
export interface MockQuery {
  factory: QueryFactory
  interrupt: Mock
  setPermissionMode: Mock
  setModel: Mock
  receivedInputs: () => SDKUserMessage[]
  lastOptions: () => { options: Options } | undefined
}

export function createMockQuery(script?: SDKMessage[]): MockQuery
```

## Edge Cases

- script 为空数组 → 生成器立即结束，产生 `{ done: true }`。
- 测试未消费完所有 script 消息就 dispose → 生成器被 abort，不抛异常。
- `setPermissionMode` 在 query 未启动时不会被调用（由 AgentService 控制）。
- `receivedInputs()` 在 send 后立即返回可能为空（异步迭代），需配合 `vi.waitFor` 使用。

## Alternatives Considered

- **直接用 vi.mock('@anthropic-ai/claude-agent-sdk')**：模块级 mock 灵活性差；createMockQuery 作为工厂注入更贴合 AgentService 设计。
- **用真实 SDK 的测试模式**：会启动子进程，慢且依赖 API key；违背 CLAUDE.md 约定。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1/2 | `tests/mocks/sdk.test.ts` | createMockQuery 返回正确结构；factory 按 script 产出消息 |
| AC-3 | 同上 | push 用户消息后 receivedInputs 包含该消息 |
| AC-4 | 同上 / `AgentService.test.ts` | interrupt / setPermissionMode spy 可被断言 |
| AC-5 | 同上 | lastOptions 保存 options.env 等字段 |
| AC-6 | 同上 | script 结束后 iterator.next() 返回 done |
