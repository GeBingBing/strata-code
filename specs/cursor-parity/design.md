# Design: cursor-parity

## Context

[requirements.md](./requirements.md) — 把 markdown 流式渲染从"灰底等宽"升级到 Cursor 级视觉体验。核心改造 `Markdown.tsx`（或新增 `MarkdownWithCode.tsx`）：`react-markdown` + `remark-gfm` + shiki 高亮 + 自定义 `code` 组件加复制按钮。ToolCallCard 识别 Read 工具增强呈现。

## Data Flow

```
Markdown 渲染管线：
ReactMarkdown
  ├─ remarkPlugins: [remarkGfm]              // 表格/任务列表等
  ├─ rehypePlugins: [rehypeShiki]            // 代码块 shiki 高亮（静态预渲染 HTML）
  └─ components: { code: CodeBlock, pre: PreBlock }
                └─ CodeBlock: 语言识别 + shiki 高亮 + ⎘ 复制按钮
                └─ PreBlock: 透传 props

ToolCallCard 增强（Read 工具）：
ToolCallCard props.item.toolName === 'Read'
  ├─ 顶部面包屑：<Breadcrumb path={input.file_path} />
  ├─ 输出折叠：默认 <details>，内容含行号 + CodeBlock 高亮
  └─ 非 Read 工具：保持现有 ToolCallCard 行为

流式进度（AC-5）：
useChatStore 流式 text → ChatView 旁 <ProgressBadge text={items[streamingId].text} />
  ├─ 估算 tokens ≈ text.length / 4
  └─ status === 'running' && streamingId 存在时显示
```

## Contracts

```ts
// 新文件 src/renderer/src/components/markdown/Markdown.tsx
export function Markdown({ text, streaming }: { text: string; streaming: boolean }): React.JSX.Element

// 新文件 src/renderer/src/components/markdown/CodeBlock.tsx（自定义 code 组件）
export function CodeBlock({ className, children, node, ...props }: CodeBlockProps): React.JSX.Element
//  1. className 提取 language-xxx
//  2. shiki.getHighlighter().codeToHtml(code, { lang, theme: 'github-light' })
//  3. 顶部 hover 出现 ⎘，onClick 调 navigator.clipboard.writeText(code)

// 新文件 src/renderer/src/components/markdown/PreBlock.tsx
//  阻止 react-markdown 默认包一层 pre（shiki 已产出 <pre>）

// ToolCallCard 增强 src/renderer/src/components/tools/ToolCallCard.tsx
// 新增判断分支：toolName === 'Read' 且 input.file_path 存在 → 面包屑 + 行号 + 高亮

// 进度条 src/renderer/src/components/chat/ProgressBadge.tsx
export function ProgressBadge({ text }: { text: string }): React.JSXElement | null
```

shiki 集成要点：
- 入口：`import { codeToHtml, bundledLanguages } } from 'shiki'` —— `bundledLanguages` 是单语言 map，按需查。
- 主题：MVP `github-light` 单主题；styles.css 覆盖 token。
- 性能：shiki 同步渲染会卡——`codeToHtml` 在 `CodeBlock` 内同步调，每秒数十次 partial 渲染需节流（复用 `useThrottledValue` 50ms 窗口内仅末次触发 shiki）。
- 流式阶段 markdown 经常是不完整代码块（缺 ``` 闭合）——CodeBlock 需 fallback：识别不到闭合的 raw 文本走纯 `<pre>` 等宽回退。

代码块复制：
- 复制成功用 `navigator.clipboard.writeText`（现有 CopyButton 已用同 API，无新依赖）。
- 短暂视觉反馈：button 切换为 ✓ 200ms 后恢复 ⎘。

行号（AC-4）：在 CodeBlock 输出后用 CSS `:before` + `counter-reset` 实现行号列（避免每个 token 重新解析），无需后处理文本。

## Edge Cases

- 流式 markdown 不完整（partial 没有 ``` 闭合）—— react-markdown 把未闭合 ``` 视为 inline code 渲染到普通文本里，CodeBlock 组件不会被调用，安全。
- shiki 不识别的语言（不在 `bundledLanguages` 里）—— try/catch 走等宽 fallback（AC-6）。
- 代码块超长（>500 行）—— CodeBlock 内容区域加 `max-height: 400px` + overflow auto + "展开全部" 链接（Cursor 行为）。
- Read 工具输出二进制/极大文件（FileService 已 isTooLarge 处理）—— ToolCallCard 不进入高亮分支，显示原始 `<pre>`。
- ProgressBadge 估算偏差——MVP 文本长度 / 4 粗估（与 SDK token 估算同阶）；不要求精确，只作为视觉提示。
- 复制按钮无障碍：button 有 title/aria-label；剪贴板不可用（permission denied）时静默回退。

## Alternatives Considered

- **rehype-highlight + highlight.js**：bundle 较小（~50KB），但语法质量不如 shiki，且 markdown 流式管线 + 节流下两者性能差距不大——选 shiki 质量优先（VSCode 同款）。
- **prism + react-syntax-highlighter**：维护活跃度下降，主题一般。否决。
- **行号用后处理**：把 shiki 输出的每行包裹 `<span>` 加 `data-line`，复杂度高且 token 数翻倍。CSS counter 方案更优。
- **多代码块交错（AC-8）双栏**：流式状态机需识别"两个独立代码块同时生成"——Agent SDK 当前串行输出，不适用。MVP 不做。
- **Checkpoint（AC-7）**：需要 AgentService 中途改写输入流的设计变更（PromptQueue 已支持），但 resume 协议需补——独立迭代。

## Test Strategy

| AC | 测试文件 | 用例 |
|----|---------|------|
| AC-1 | src/renderer/src/components/markdown/CodeBlock.test.tsx | shiki 高亮：ts 代码块渲染输出含 `<span class="...">` token |
| AC-2 | 同上 + 集成 | hover 显按钮、点击写入剪贴板、按钮短暂 ✓ 反馈；用 setIpcOverride 注入 mocked clipboard |
| AC-3 | src/renderer/src/components/tools/ToolCallCard.test.tsx 扩展 | 面包屑显示 basename + 完整路径 |
| AC-4 | 同上 | 行号渲染 + 高亮 + 默认折叠 |
| AC-5 | src/renderer/src/components/chat/ProgressBadge.test.tsx | running 时显示估算 tokens；idle 时不显示 |
| AC-6 | src/renderer/src/components/markdown/CodeBlock.test.tsx | 不识别语言 fallback 等宽 |
| e2e | tests/e2e/cursor-parity.spec.ts | fake 模式：含 markdown 回复 → 代码块带高亮（snapshot data-attr）+ 复制按钮 + Read 工具面包屑 |

测试 stub 策略：shiki 同步渲染耗时大，单测用 `vi.mock('shiki', () => ({ bundledLanguages: {ts:{...}}, codeToHtml: () => '<pre><code>highlighted</code></pre>' }))`。