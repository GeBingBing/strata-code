import { useEffect, useRef, useState } from 'react'
import { getSingletonHighlighter } from 'shiki'
import { useConfigStore } from '../../state/configStore'

/**
 * 自定义 code 组件（spec: cursor-parity AC-1/6）。
 *
 * 流式期间不调用 shiki —— 避免每个字符触发整段代码块重新高亮 + DOM 重排。
 * 仅当 streaming=false 或代码块累计稳定后再异步高亮。
 * spec: light-theme —— shiki 加载 github-light + github-dark 双主题，按当前 editor.theme 选择。
 *
 * 复制功能统一由消息级 CopyButtonGroup 提供（spec: session-export 1.3），
 * 此处不再带 code-block 局部复制按钮，避免与消息级按钮重复。
 */

interface CodeBlockProps {
  className?: string
  children?: React.ReactNode
  node?: unknown
  streaming?: boolean
}

const SUPPORTED_LANGS = ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'sh', 'shell', 'python', 'css', 'html', 'markdown', 'md', 'yaml', 'yml', 'diff', 'go', 'rust', 'sql', 'vue', 'typescript', 'javascript'] as const
const highlighterPromise = getSingletonHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: [...SUPPORTED_LANGS]
})

function extractLanguage(className?: string): string | undefined {
  const m = /language-([\w+-]+)/.exec(className ?? '')
  return m?.[1]
}

function isLangSupported(lang: string): boolean {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang)
}

function themeOf(theme: 'vs' | 'vs-dark' | 'hc-black'): 'github-light' | 'github-dark' {
  return theme === 'vs' ? 'github-light' : 'github-dark'
}

export function CodeBlock({ className, children, node: _node, streaming = false }: CodeBlockProps): React.JSX.Element {
  const lang = extractLanguage(className)
  const raw = typeof children === 'string' ? children : String(children ?? '')
  const theme = useConfigStore((s) => s.editor.theme)
  // 初始用纯文本，避免 markdown 流式时反复触发 shiki → 整块 DOM 重排
  const [html, setHtml] = useState<string>(() => fallbackHtml(raw))
  // 跟踪上一次高亮过的内容，避免无意义重复渲染
  const lastHighlightedRef = useRef<{ raw: string; theme: string }>({ raw: '', theme: '' })

  useEffect(() => {
    if (!lang || !isLangSupported(lang)) {
      setHtml(fallbackHtml(raw))
      return
    }
    // 流式期间延后高亮：等 streaming=false 后再统一处理
    if (streaming) {
      const lastLen = lastHighlightedRef.current.raw.length
      if (lastLen > 0 && raw.length < lastLen * 1.2) {
        return
      }
    }
    let cancelled = false
    highlighterPromise
      .then((hl) => hl.codeToHtml(raw, { lang, theme: themeOf(theme) }))
      .then((h) => {
        if (!cancelled) {
          lastHighlightedRef.current = { raw, theme }
          setHtml(h)
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(fallbackHtml(raw))
      })
    return () => {
      cancelled = true
    }
  }, [raw, lang, streaming, theme])

  return (
    <div
      className={`code-block ${streaming ? 'code-block-streaming' : ''}`}
      data-language={lang ?? 'plain'}
      data-testid="code-block"
    >
      <div className="code-block-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function fallbackHtml(raw: string): string {
  return `<pre><code>${escape(raw)}</code></pre>`
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[ch] ?? ch))
}
