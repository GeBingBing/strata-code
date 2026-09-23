/**
 * spec: session-export 1.3 —— 把 markdown 文本转成"复制可见文本"用的纯文本。
 * 用于助手消息的 copy-md 按钮：保留用户可读文字，去掉 markdown 标记。
 *
 * 这是"近似"实现 —— 不替代完整 markdown 解析器，目标场景是粘贴到 IM/邮件等
 * 不渲染 markdown 的位置后仍可读。代码块内容保持原文（去掉 ``` 围栏），
 * 以便保留缩进与多行结构。
 */
export function markdownToPlainText(md: string): string {
  let s = md

  // 围栏代码块：保留内容，去掉 ```lang 与 ``` 标记
  s = s.replace(/```[a-zA-Z0-9_-]*\n?/g, '')

  // 行内代码：`code` → code
  s = s.replace(/`([^`]+)`/g, '$1')

  // 图片 ![alt](url) → alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

  // 链接 [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 粗体 / 斜体：先处理 ***text*** / **text** / __text__ / *text* / _text_
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*\n]+)\*/g, '$1')
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1$2')

  // 标题前缀 #, ##, ### ...（用 [ \t]+ 避免 \s 把上一行尾的换行一起吞掉）
  s = s.replace(/^#{1,6}[ \t]+/gm, '')

  // 引用 >（注意：[ \t]* 仅匹配空格/制表，避免吞掉上一行的换行）
  s = s.replace(/^[ \t]*>\s?/gm, '')

  // 列表标记 - / * / 数字.
  s = s.replace(/^[ \t]*[-*+]\s+/gm, '')
  s = s.replace(/^[ \t]*\d+\.\s+/gm, '')

  // 水平线
  s = s.replace(/^[ \t]*([-*_])\s*\1\s*\1[^\n]*$/gm, (m) => m.replace(/[-*_]/g, ''))

  // 折叠多余的空行（≥3 个 → 2 个），并 trim 行尾空白
  s = s
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
  s = s.replace(/\n{3,}/g, '\n\n')

  return s.trim()
}