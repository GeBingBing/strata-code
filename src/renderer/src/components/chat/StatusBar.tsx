import { useChatStore } from '../../state/chatStore'
import { useConfigStore } from '../../state/configStore'
import { useEditorStore } from '../../state/editorStore'

export function StatusBar(): React.JSX.Element {
  const status = useChatStore((s) => s.status)
  const costUsd = useChatStore((s) => s.costUsd)
  const usage = useChatStore((s) => s.usage)
  const items = useChatStore((s) => s.items)
  const cwd = useConfigStore((s) => s.cwd)
  const permissionMode = useConfigStore((s) => s.permissionMode)
  const model = useConfigStore((s) => s.model)
  const agentMode = useConfigStore((s) => s.agentMode)
  const pickWorkspace = useConfigStore((s) => s.pickWorkspace)
  const closeAll = useEditorStore((s) => s.closeAll)
  const tabs = useEditorStore((s) => s.tabs)
  const dirtyCount = tabs.filter((t) => t.dirty).length
  const running = status === 'running'

  const handlePickWorkspace = (): void => {
    if (items.length > 0 || dirtyCount > 0) {
      const confirmMsg = `切换工作目录将清空当前会话${dirtyCount > 0 ? `并丢弃 ${dirtyCount} 个未保存的文件` : ''}。继续？`
      if (!window.confirm(confirmMsg)) return
      closeAll()
      useChatStore.getState().reset()
    }
    void pickWorkspace()
  }

  return (
    <footer className="status-bar" data-testid="status-bar">
      <span className={`status-dot ${status}`} />
      <span>{status === 'running' ? '运行中' : status === 'error' ? '出错' : '空闲'}</span>
      <button
        type="button"
        className="status-cwd"
        data-testid="status-cwd"
        onClick={handlePickWorkspace}
        disabled={running}
        title="点击切换工作目录"
      >
        {cwd || '…'}
      </button>
      <span className="status-mode" data-testid="status-mode" title="权限模式">
        {permissionMode}
      </span>
      <span className="status-model" data-testid="status-model" title="模型">
        {model}
      </span>
      {agentMode === 'fake' && (
        <span className="status-agent-mode" data-testid="status-agent-mode">
          fake
        </span>
      )}
      {typeof costUsd === 'number' && <span className="cost">${costUsd.toFixed(4)}</span>}
      {usage && (
        <span className="status-tokens" data-testid="status-tokens" title="token 用量（输入→输出）">
          {formatTokens(usage.inputTokens)}→{formatTokens(usage.outputTokens)} tok
        </span>
      )}
    </footer>
  )
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
