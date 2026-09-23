import Editor, { loader, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../state/editorStore'
import { useConfigStore } from '../../state/configStore'
import { invoke } from '../../ipc/client'
import { InlineChat } from './InlineChat'
import { MemoIcon } from '../icons'

// 让 @monaco-editor/react 使用本地打包的 monaco-editor（避免 CDN 离线加载失败）
loader.config({ monaco })

const LANG_BY_EXT: Record<string, string> = {
  // JavaScript / TypeScript
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Web / 前端
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  vue: 'html', svelte: 'html',
  // 数据 / 配置
  json: 'json', jsonc: 'json', json5: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini', ini: 'ini', conf: 'ini', env: 'ini', properties: 'ini',
  // 文档
  md: 'markdown', mdx: 'markdown',
  // 脚本 / 系统
  sh: 'shell', bash: 'shell', zsh: 'shell',
  ps1: 'powershell', bat: 'bat', cmd: 'bat',
  // 后端语言
  py: 'python', rb: 'ruby', php: 'php', pl: 'perl', lua: 'lua',
  go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', scala: 'scala',
  clj: 'clojure', cljs: 'clojure',
  cs: 'csharp', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  m: 'objective-c', swift: 'swift', dart: 'dart',
  // 函数式 / 脚本
  hs: 'haskell', ml: 'ocaml', fs: 'fsharp', ex: 'elixir', exs: 'elixir', erl: 'erlang',
  r: 'r', jl: 'julia',
  // 数据库 / 数据
  sql: 'sql', graphql: 'graphql', gql: 'graphql', proto: 'protobuf',
  // 基础设施
  dockerfile: 'dockerfile', tf: 'terraform', hcl: 'hcl',
  // 其他
  log: 'plaintext', txt: 'plaintext'
}

const LANG_BY_FILENAME: Record<string, string> = {
  Dockerfile: 'dockerfile', Makefile: 'makefile', CMakeLists: 'cpp',
  '.bashrc': 'shell', '.zshrc': 'shell', '.profile': 'shell',
  '.gitignore': 'plaintext', '.env': 'plaintext',
  '.editorconfig': 'ini', '.eslintrc': 'json', '.prettierrc': 'json',
  'tsconfig.json': 'json'
}

function langOf(path: string): string {
  const name = path.split('/').pop() ?? ''
  if (LANG_BY_FILENAME[name]) return LANG_BY_FILENAME[name]
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return LANG_BY_EXT[ext] ?? 'plaintext'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString()
}

const LoadingComponent = (): React.JSX.Element => (
  <div className="editor-loading" data-testid="editor-loading">
    <div className="spinner" />
    <span>正在加载编辑器…</span>
  </div>
)

const TextareaFallback = ({
  value,
  onChange,
  readOnly,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  placeholder?: string
}): React.JSX.Element => (
  <textarea
    className="editor-textarea-fallback"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    readOnly={readOnly}
    placeholder={placeholder}
    spellCheck={false}
  />
)

export function EditorArea(): React.JSX.Element {
  const tabs = useEditorStore((s) => s.tabs)
  const activePath = useEditorStore((s) => s.activePath)
  const setActive = useEditorStore((s) => s.setActive)
  const closeTab = useEditorStore((s) => s.close)
  const updateContent = useEditorStore((s) => s.updateContent)
  const markSaved = useEditorStore((s) => s.markSaved)
  const pendingCursor = useEditorStore((s) => s.pendingCursor)
  const clearPendingCursor = useEditorStore((s) => s.clearPendingCursor)
  const editor = useConfigStore((s) => s.editor)
  const active = tabs.find((t) => t.path === activePath)
  const [editorContent, setEditorContent] = useState(active?.content ?? '')
  const [monacoFailed, setMonacoFailed] = useState(false)
  /** spec: inline-chat —— 浮层状态；非空时在 editor-host 内渲染 */
  const [inlineChat, setInlineChat] = useState<{ startLine: number; endLine: number } | null>(null)
  const contentRef = useRef(editorContent)
  contentRef.current = editorContent
  /** spec: search-navigation —— 持有 Monaco 实例供 reveal 与后续 InlineChat 共用 */
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // tab 切换：重置编辑器内容与降级标记（AC-4）
  useEffect(() => {
    setEditorContent(active?.content ?? '')
    setMonacoFailed(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath])

  // 外部通道（file-watcher 静默重载等）更新 store 时同步编辑器；与本地一致则不打扰输入（AC-5）
  useEffect(() => {
    if (active && active.content !== contentRef.current) {
      setEditorContent(active.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.content])

  // spec: search-navigation —— pendingCursor 命中 → reveal + setPosition + focus (AC-1/3)
  useEffect(() => {
    if (!pendingCursor || !active || pendingCursor.path !== active.path) return
    const ed = editorRef.current
    if (!ed || active.isBinary || active.isTooLarge) return
    const model = ed.getModel()
    if (!model) return
    const lineCount = model.getLineCount()
    const line = Math.min(Math.max(1, pendingCursor.line), lineCount)
    const column = Math.min(
      Math.max(1, pendingCursor.column ?? 1),
      model.getLineMaxColumn(line)
    )
    ed.revealLineInCenter(line)
    ed.setPosition({ lineNumber: line, column })
    ed.focus()
    clearPendingCursor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCursor, activePath])

  const handleEditorChange = (v: string): void => {
    setEditorContent(v)
    if (active) {
      updateContent(active.path, v)
    }
  }

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed
    // spec: inline-chat —— Cmd+K 弹出 InlineChat 浮层（仅在编辑器聚焦时触发）
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      if (!active) return
      const sel = ed.getSelection()
      const start = sel?.startLineNumber ?? 1
      const end = sel?.endLineNumber ?? start
      setInlineChat({ startLine: start, endLine: end })
    })
    // spec: chat-ui —— CmdOrCtrl + S 保存（用 monaco 常量替换硬编码位掩码）
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void save())
  }

  const save = async (): Promise<void> => {
    if (!active) return
    // 从 store 读取最新内容（与命令面板保存路径统一，AC-2）
    const content = useEditorStore.getState().tabs.find((t) => t.path === active.path)?.content ?? editorContent
    try {
      await invoke('file:write', { path: active.path, content })
      markSaved(active.path)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('save failed:', err)
    }
  }

  if (!active) {
    return (
      <div className="editor-empty" data-testid="editor-empty">
        <div className="empty-icon"><MemoIcon size={48} /></div>
        <h3>选择文件开始编辑</h3>
        <p>从左侧文件树选择，或按快捷键</p>
        <p className="hint">Cmd+P 快速打开 · Cmd+Shift+P 命令面板</p>
      </div>
    )
  }

  const filename = active.path.split('/').pop() ?? active.path
  const sizeStr = formatBytes(active.size)
  const mtimeStr = formatTime(active.mtime)

  // 二进制 / 超大文件占位
  if (active.isBinary || active.isTooLarge) {
    return (
      <div className="editor-area" data-testid="editor-area">
        <div className="editor-tabs">
          {tabs.map((t) => (
            <button
              key={t.path}
              type="button"
              className={`editor-tab ${t.path === activePath ? 'active' : ''} ${t.dirty ? 'dirty' : ''}`}
              data-testid={`editor-tab-${t.path}`}
              onClick={() => setActive(t.path)}
            >
              <span>{t.path.split('/').pop()}</span>
              <span
                role="button"
                tabIndex={-1}
                className="tab-close"
                data-testid={`close-${t.path}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.path)
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
        <div className="editor-placeholder" data-testid="editor-binary-placeholder">
          <div className="placeholder-icon">📦</div>
          <h3>{active.isBinary ? '二进制文件' : '文件过大'}</h3>
          <p>
            {active.isBinary
              ? '检测到二进制内容（空字节），无法在编辑器中查看或编辑'
              : `文件超过 1 MB，无法在编辑器中打开。当前大小：${sizeStr}`}
          </p>
          <dl className="placeholder-meta">
            <dt>路径</dt><dd>{active.path}</dd>
            <dt>大小</dt><dd>{sizeStr}</dd>
            <dt>修改时间</dt><dd>{mtimeStr}</dd>
          </dl>
          <p className="hint">提示：用 Finder / VSCode 等原生工具打开此文件</p>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-area" data-testid="editor-area">
      <div className="editor-tabs">
        {tabs.map((t) => (
          <button
            key={t.path}
            type="button"
            className={`editor-tab ${t.path === activePath ? 'active' : ''} ${t.dirty ? 'dirty' : ''}`}
            data-testid={`editor-tab-${t.path}`}
            onClick={() => setActive(t.path)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                closeTab(t.path)
              }
            }}
          >
            <span>{t.path.split('/').pop()}</span>
            {t.dirty && <span className="dirty-dot" />}
            <span
              role="button"
              tabIndex={-1}
              className="tab-close"
              data-testid={`close-${t.path}`}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.path)
              }}
            >
              ✕
            </span>
          </button>
        ))}
      </div>
      <div className="editor-host">
        {monacoFailed ? (
          <TextareaFallback
            value={editorContent}
            onChange={handleEditorChange}
            placeholder="Monaco 加载失败，已降级到纯文本编辑（仍可保存）"
          />
        ) : (
          <Editor
            height="100%"
            defaultLanguage={langOf(active.path)}
            language={langOf(active.path)}
            theme={editor.theme}
            value={editorContent}
            onChange={(v) => handleEditorChange(v ?? '')}
            onMount={handleMount}
            loading={<LoadingComponent />}
            onValidate={() => {
              // eslint-disable-next-line no-console
              // 标记 Monaco 已加载（避免误触发降级）
            }}
            options={{
              minimap: { enabled: editor.minimap },
              fontSize: editor.fontSize,
              wordWrap: editor.wordWrap ? 'on' : 'off'
            }}
          />
        )}
        {inlineChat && !monacoFailed && (
          <InlineChat
            path={active.path}
            basename={filename}
            startLine={inlineChat.startLine}
            endLine={inlineChat.endLine}
            onClose={() => setInlineChat(null)}
          />
        )}
      </div>
      {monacoFailed && (
        <div className="editor-meta" data-testid="editor-meta">
          <span>{filename}</span>
          <span>·</span>
          <span>{sizeStr}</span>
          <span>·</span>
          <span>{mtimeStr}</span>
          <span>·</span>
          <span className="meta-warning">编辑器加载失败，已降级</span>
        </div>
      )}
      {!monacoFailed && (
        <div className="editor-meta">
          <span>{filename}</span>
          <span>·</span>
          <span>{sizeStr}</span>
          <span>·</span>
          <span>{mtimeStr}</span>
        </div>
      )}
    </div>
  )
}