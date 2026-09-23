import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

/**
 * 升级版 markdown 渲染（spec: cursor-parity AC-1/3）。
 * - remark-gfm：表格 / 删除线 / 任务列表
 * - 自定义 code 组件：shiki 语法高亮 + 复制按钮
 * - 自定义 pre：透传（CodeBlock 已含 .code-block-body）
 *
 * 流式与非流式均使用同一组件；节流由调用方（useThrottledValue）负责。
 */
export function Markdown({ text, streaming }: { text: string; streaming: boolean }): React.JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // code 组件捕获 ```lang fenced code blocks；行内 `code` 不走我们（react-markdown 默认）
        code: ({ className, children, node, ...rest }) => (
          <CodeBlock className={className} node={node} streaming={streaming} {...rest}>
            {children}
          </CodeBlock>
        )
      }}
    >
      {text}
    </ReactMarkdown>
  )
}