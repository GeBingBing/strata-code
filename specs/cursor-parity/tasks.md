# Tasks: cursor-parity

> 每项 ≤1 天；TDD = 先写失败测试（标注文件），再实现变绿。tasks.md 是进度唯一事实源。

## 1. 依赖与基础（AC-1/6）

- [x] 1.1 安装 shiki + remark-gfm（写入 package.json）
- [x] 1.2 失败测试: CodeBlock ts 高亮产出 token spans + 不识别语言 fallback → `src/renderer/src/components/markdown/CodeBlock.test.tsx` (AC-1/6)
- [x] 1.3 实现 `CodeBlock.tsx`（shiki 单例 highlighter + 异步 setHtml + 错误 fallback）

## 2. 代码块复制按钮（AC-2）

- [x] 2.1 失败测试: hover 显 ⎘、点击写剪贴板、短暂 ✓ 反馈 → 同上 (AC-2)
- [x] 2.2 实现 copy 按钮（hover 显示 / 200ms ✓ 反馈 / 权限失败静默）

## 3. Markdown 组件整合（AC-1）

- [x] 3.1 失败测试: Markdown 渲染 h2 + CodeBlock + gfm 表格 → `src/renderer/src/components/markdown/Markdown.test.tsx`
- [x] 3.2 实现 `Markdown.tsx`（ReactMarkdown + remarkGfm + code=CodeBlock）
- [x] 3.3 替换 `MessageItem.tsx` 流式/非流式分支 `<ReactMarkdown>` 为 `<Markdown>`（保留 useThrottledValue + 光标）

## 4. ToolCallCard Read 增强（AC-3/4）

- [x] 4.1 失败测试: Read 工具面包屑 + 默认折叠 + 展开后行号 + CodeBlock → `src/renderer/src/components/tools/ToolCallCard.test.tsx`
- [x] 4.2 实现 ToolCallCard 内 `toolName==='Read'` 分支（basename 面包屑 + ReadLineNumbers + CodeBlock 高亮）

## 5. 流式进度徽标（AC-5）

- [x] 5.1 失败测试: running + streaming text 时显示估算 tokens；idle/空文本不显示 → `src/renderer/src/components/chat/ProgressBadge.test.tsx`
- [x] 5.2 实现 ProgressBadge + ChatView 流式气泡旁接入（基于 streamingId + status==='running'）

## 6. E2E + 视觉回归

- [x] 6.1 E2E fake 模式 Read 工具面包屑元素出现 → `tests/e2e/cursor-parity.spec.ts`
- [x] 6.2 全量回归：113 main + 98 renderer + 4 e2e 全绿；类型检查 OK

## 7. Stretch（独立迭代）

- [x] 7.1 AC-7 Checkpoint（生成中可中断并从指定中间状态继续）—— stop 保留 partial output + `continue-from-{id}` 按钮触发 `app:focus-composer`；SDK 会话延续使追加消息自然衔接上下文
- [ ] 7.2 AC-8 多代码块双栏并行布局 —— 需要 Markdown 组件结构改造（依赖 react-markdown 节点遍历），独立 spec 再实现
- [x] 7.3 AC-9 thinking 全局策略（默认折叠/隐藏 + 用户切换）—— `configStore.thinkingDefaultExpanded` 持久化 localStorage；`ThinkingBlock` 从 store 读初值；设置面板新增 `settings-thinking-default-expanded` 开关

> 实现备注：
- shiki 4.x 用 `getSingletonHighlighter` 单例（异步初始化 wasm）→ CodeBlock 用 useState fallback + useEffect 异步 setHtml。流式 markdown 50ms 节流保证高亮调用次数可控。
- 复制按钮 hover 显 ⎘，复制成功 200ms ✓ 后恢复。
- Read 工具面包屑 `data-testid="tool-breadcrumb"` + title=完整路径；行号容器 `data-testid="read-line-numbers"` + CodeBlock 高亮输出。
- 进度徽标估算：字符数 / 4，与 SDK 估算同阶（粗估，非精确）。