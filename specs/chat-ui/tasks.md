# Tasks: chat-ui

## 1. applySdkMessage reducer（TDD）

- [x] 1.1 失败测试: partial 累积 + streaming 光标 (AC-1) → `applySdkMessage.test.ts`
- [x] 1.2 失败测试: final 替换同 id 气泡、不重复 (AC-2) → 同上
- [x] 1.3 失败测试: tool_use → 工具条目 running；tool_result → success/error (AC-3/4) → 同上
- [x] 1.4 失败测试: result → idle + cost + 残留流式气泡定稿；error → 错误条目 (AC-5/8) → 同上
- [x] 1.5 实现 `src/renderer/src/lib/applySdkMessage.ts`

## 2. store 与 IPC 接线

- [x] 2.1 zustand chatStore + applySdkMessage 集成 + agent:message/agent:status/agent:error 订阅
- [x] 2.2 失败测试 → 实现：Composer 提交/停止逻辑 (AC-6/7) → `Composer.test.tsx`
- [x] 2.3 openSession/reset 动作（历史回放，session-history AC-4 配合）

## 3. 组件

- [x] 3.1 ChatView + MessageList + MessageItem（react-markdown、流式光标）
- [x] 3.2 Composer（自适应高度 textarea、Enter 发送、Shift+Enter 换行、运行中变停止按钮）
- [x] 3.3 ToolCallCard（可折叠参数/输出、状态图标）+ DiffPreview（unified diff 着色）
- [x] 3.4 StatusBar（状态、cost）
- [x] 3.5 ChatView 渲染测试 → `ChatView.test.tsx`
- [x] 3.6 全部测试跑绿

## 4. Cursor 式流式 markdown 渲染（AC-9/10）

- [x] 4.1 失败测试: useThrottledValue —— 窗口内不提交中间值、窗口结束提交最新值、停止更新最终值必达 → `src/renderer/src/lib/useThrottledValue.test.ts` (AC-10)
- [x] 4.2 失败测试: 流式 assistant 气泡实时 markdown 渲染（`**bold**` → strong、`code`）+ 打字机光标 + 流式 thinking 折叠可见 → `src/renderer/src/components/chat/MessageItem.test.tsx` 扩展 (AC-9)
- [x] 4.3 实现: `useThrottledValue` hook（trailing-edge 节流，~50ms 窗口结束必达）+ MessageItem 流式分支改 ReactMarkdown（替换 StreamingPreview）+ `StreamingMarkdown` 子组件
- [x] 4.4 删除 StreamingPreview 组件与测试；旧"流式不渲染 ThinkingBlock"测试替换为"流式也渲染 ThinkingBlock"（thinking 实时折叠）；ChatView/e2e 回归全绿

## 5. 蒸馏徽标产品改进（顺手）

- [x] 5.1 失败测试: 蒸馏徽标文案自适应（新增 `+N` / 仅更新 `~N` / 仅淘汰 `-N`） → `src/renderer/src/components/chat/StatusBar.test.tsx`
- [x] 5.2 ChatState.lastDistill 扩展为 `{added, updated, retired, updatedAt}`；StatusBar 渲染条件改为 added/updated/retired 任一 > 0
- [x] 5.3 e2e memory.spec.ts 徽标断言改为元素可见 + 含 "记忆"（避免累积数据导致合并 added=0）

> 备注：原徽标只显示 added>0，e2e 多次运行累积 userData 让 FakeDistiller 提案合并到已有条目 → added=0 徽标不出现。徽标现在显示完整蒸馏成果（新增/更新/淘汰），更准确反映自进化；测试断言改为元素存在。