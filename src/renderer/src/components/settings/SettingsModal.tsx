import { useConfigStore, type ThemeName } from '../../state/configStore'
import { PermissionModeSelector } from '../chat/PermissionModeSelector'
import { ModelSelector } from '../chat/ModelSelector'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props): React.JSX.Element | null {
  const editor = useConfigStore((s) => s.editor)
  const setTheme = useConfigStore((s) => s.setTheme)
  const setFontSize = useConfigStore((s) => s.setFontSize)
  const toggleWordWrap = useConfigStore((s) => s.toggleWordWrap)
  const toggleMinimap = useConfigStore((s) => s.toggleMinimap)
  const thinkingDefaultExpanded = useConfigStore((s) => s.thinkingDefaultExpanded)
  const setThinkingDefaultExpanded = useConfigStore((s) => s.setThinkingDefaultExpanded)

  if (!open) return null

  return (
    <div className="modal-overlay" data-testid="settings-modal" role="dialog" aria-modal="true">
      <div className="modal settings-modal">
        <div className="settings-header">
          <h3>设置</h3>
          <button type="button" className="settings-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <section className="settings-section" data-testid="settings-editor">
          <h4>编辑器</h4>
          <div className="settings-row">
            <label htmlFor="settings-theme">主题</label>
            <select
              id="settings-theme"
              data-testid="settings-theme"
              value={editor.theme}
              onChange={(e) => setTheme(e.target.value as ThemeName)}
            >
              <option value="vs">浅色</option>
              <option value="vs-dark">深色</option>
              <option value="hc-black">高对比</option>
            </select>
          </div>
          <div className="settings-row">
            <label htmlFor="settings-font-size">字体大小</label>
            <input
              id="settings-font-size"
              data-testid="settings-font-size"
              type="number"
              min={8}
              max={32}
              value={editor.fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>
          <div className="settings-row">
            <label className="settings-checkbox">
              <input
                data-testid="settings-word-wrap"
                type="checkbox"
                checked={editor.wordWrap}
                onChange={toggleWordWrap}
              />
              自动换行
            </label>
          </div>
          <div className="settings-row">
            <label className="settings-checkbox">
              <input
                data-testid="settings-minimap"
                type="checkbox"
                checked={editor.minimap}
                onChange={toggleMinimap}
              />
              显示 minimap
            </label>
          </div>
        </section>

        <section className="settings-section" data-testid="settings-agent">
          <h4>Agent</h4>
          <div className="settings-row">
            <label htmlFor="settings-model">模型</label>
            <ModelSelector />
          </div>
          <div className="settings-row">
            <label htmlFor="settings-permission-mode">权限模式</label>
            <PermissionModeSelector />
          </div>
          {/* spec: cursor-parity AC-9 —— thinking 全局默认展开策略 */}
          <div className="settings-row">
            <label className="settings-checkbox">
              <input
                data-testid="settings-thinking-default-expanded"
                type="checkbox"
                checked={thinkingDefaultExpanded}
                onChange={(e) => setThinkingDefaultExpanded(e.target.checked)}
              />
              Thinking 默认展开
            </label>
          </div>
        </section>

        <section className="settings-section" data-testid="settings-about">
          <h4>关于</h4>
          <p className="settings-about-text">Claude SDK Agent — 桌面 AI 编程助手</p>
          <p className="settings-about-text">基于 Claude Agent SDK + Electron + React</p>
        </section>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
