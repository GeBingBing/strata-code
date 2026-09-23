# Tasks: context-engineering

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. AgentService 接缝（主进程）

- [x] 1.1 失败测试: Options 默认含 `settingSources: ['user','project','local']`；options.settingSources 可覆盖 → `tests/main/agent/AgentService.context.test.ts` (AC-1)
- [x] 1.2 失败测试: buildSystemPromptAppend 非空 → `systemPrompt: {type:'preset',preset:'claude_code',append}`；空/未提供 → 无 systemPrompt 键 → 同上 (AC-2/3)
- [x] 1.3 失败测试: append await 期间再次 send → 两条文本进同一输入流、factory 只调一次 → 同上 (AC-4)
- [x] 1.4 失败测试: result.usage/num_turns → agent:status {usage, numTurns} → 同上 (AC-5)
- [x] 1.5 失败测试: result → onRunComplete 恰好一次、字段正确 → 同上 (AC-6)
- [x] 1.6 实现: AgentService start() async 化 + pendingStart 守卫 + RunCompleteInfo + AgentStatusEvent 扩展（src/shared/types.ts）

## 2. 渲染层 token 可见性

- [x] 2.1 失败测试: result 消息/applyAgentStatus 含 usage/numTurns → ChatState 存储字段 → `src/renderer/src/lib/applySdkMessage.test.ts` (AC-5)
- [x] 2.2 失败测试: StatusBar 渲染 `status-tokens`（如 "1.2k→345 tok"）→ `src/renderer/src/components/chat/StatusBar.test.tsx` (AC-7)
- [x] 2.3 实现: ChatState.usage/numTurns + StatusBar 显示

> 备注：append 抛异常路径有专项测试（agent:error 不挂起）。index.ts 的实际接线（buildSystemPromptAppend ← MemoryInjector）在 memory-injection spec 完成。
