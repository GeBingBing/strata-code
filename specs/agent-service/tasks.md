# Tasks: agent-service

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. Mock SDK 基座

- [x] 1.1 失败测试: createMockQuery 产出脚本化 SDKMessage 序列 + interrupt/setPermissionMode 间谍 → `tests/mocks/sdk.test.ts`

## 2. PromptQueue（流式输入）

- [x] 2.1 失败测试: push → 迭代产出 {type:'user', message:{role:'user', content}} (AC-1) → `tests/main/agent/PromptQueue.test.ts`
- [x] 2.2 失败测试: 迭代器等待新消息不忙轮询；多轮顺序保持 → 同上
- [x] 2.3 实现 `src/main/agent/PromptQueue.ts`

## 3. AgentService

- [x] 3.1 失败测试: 每条 SDKMessage → agent:message 信封、seq 单调递增 (AC-2) → `tests/main/agent/AgentService.test.ts`
- [x] 3.2 失败测试: result 消息 → agent:status idle + cost/duration (AC-4)；系统消息 session id 捕获 (AC-6) → 同上
- [x] 3.3 失败测试: interrupt / setPermissionMode 代理 (AC-3/7) → 同上
- [x] 3.4 失败测试: 流异常 → agent:error + 复位 (AC-5) → 同上
- [x] 3.5 失败测试: dispose → abort (AC-8) → 同上
- [x] 3.6 失败测试: 会话切换（send 带 resume 不同 id → 重启查询带 resume）
- [x] 3.7 实现 `src/main/agent/AgentService.ts`（QueryFactory 接缝；switchSession；factory 同步异常走 error 路径）
- [x] 3.8 实现 `src/main/agent/FakeAgent.ts`（APP_AGENT_MODE=fake）

## 4. 集成

- [x] 4.1 注册 agent:* IPC handlers 到 handleInvoke（src/main/index.ts）
- [x] 4.2 E2E fake 模式: 发消息 → 收到脚本化流式回复 → `tests/e2e/chat.spec.ts` ✓（含 retry 1 缓解冷启动抖动）
