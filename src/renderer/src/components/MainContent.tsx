import { useEffect, useState } from 'react'
import { useEditorStore } from '../state/editorStore'
import { ChatView } from './chat/ChatView'
import { EditorArea } from './editor/EditorArea'
import { Splitter } from './Splitter'

const STORAGE_KEY = 'splitter-ratio-horizontal'
const DEFAULT_RATIO = 0.6

function loadInitialRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_RATIO
    const v = Number(raw)
    if (Number.isFinite(v) && v >= 0.15 && v <= 0.85) return v
  } catch {
    // ignore
  }
  return DEFAULT_RATIO
}

/**
 * Cursor 风格主区域：左侧 Editor（带 tabs），右侧 Chat（消息 + Composer）。
 * 两侧均有「空态」：左侧无文件时显示「从文件树打开」，右侧无消息时显示「向 Claude 提问」。
 * 中间分隔条可拖动调整比例，比例持久化到 localStorage。
 */
export function MainContent(): React.JSX.Element {
  const tabs = useEditorStore((s) => s.tabs)
  const [ratio, setRatio] = useState<number>(loadInitialRatio)
  const [collapsed, setCollapsed] = useState<'none' | 'left' | 'right'>('none')

  // ratio 必须在所有 hook 之后
  useEffect(() => {
    // 触发初始保存
    if (ratio !== loadInitialRatio()) {
      try {
        localStorage.setItem(STORAGE_KEY, String(ratio))
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="main-content" data-testid="main-content">
      {collapsed !== 'left' && tabs.length > 0 && (
        <div
          className="main-pane editor-pane"
          style={{ flexBasis: `${ratio * 100}%` }}
          data-testid="editor-pane"
        >
          <EditorArea />
        </div>
      )}
      {collapsed === 'none' && tabs.length > 0 && (
        <Splitter onChange={setRatio} direction="horizontal" />
      )}
      {collapsed !== 'right' && (
        <div
          className={`main-pane chat-pane ${tabs.length === 0 ? 'full' : ''}`}
          style={tabs.length > 0 ? { flexBasis: `${(1 - ratio) * 100}%` } : undefined}
          data-testid="chat-pane"
        >
          <ChatView />
        </div>
      )}
      <div className="pane-collapse-bar">
        {collapsed === 'none' && tabs.length > 0 ? (
          <>
            <button
              type="button"
              className="collapse-btn"
              data-testid="collapse-left"
              onClick={() => setCollapsed('left')}
              title="折叠左侧编辑器"
            >
              ◀
            </button>
            <button
              type="button"
              className="collapse-btn"
              data-testid="collapse-right"
              onClick={() => setCollapsed('right')}
              title="折叠右侧聊天"
            >
              ▶
            </button>
          </>
        ) : (
          <button
            type="button"
            className="collapse-btn"
            data-testid="expand"
            onClick={() => setCollapsed('none')}
            title="展开双栏"
          >
            {collapsed === 'left' ? '▶' : '◀'}
          </button>
        )}
      </div>
    </div>
  )
}