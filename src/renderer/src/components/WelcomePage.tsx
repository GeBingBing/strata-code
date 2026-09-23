import { useChatStore } from '../state/chatStore'
import { useSessionStore } from '../state/sessionStore'
import { useConfigStore } from '../state/configStore'
import { ChatIcon, FolderIcon, KeyboardIcon } from './icons'

export function WelcomePage(): React.JSX.Element {
  const newChat = useSessionStore((s) => s.newChat)
  const pickWorkspace = useConfigStore((s) => s.pickWorkspace)
  const cwd = useConfigStore((s) => s.cwd)

  const startChat = (): void => {
    newChat()
    useChatStore.getState().reset()
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]')
    textarea?.focus()
  }

  return (
    <main className="welcome" data-testid="welcome-page">
      <h1>Claude SDK Agent</h1>
      <p className="welcome-tagline">桌面 AI 编程助手 · 类 Cursor / VSCode 体验</p>
      <div className="welcome-cards">
        <div className="welcome-card" data-testid="welcome-new-chat">
          <h3><ChatIcon size={18} /> 新对话</h3>
          <p>向 Claude 描述任务，开始编程</p>
          <button type="button" onClick={startChat}>开始对话 (Cmd+Shift+N)</button>
        </div>
        <div className="welcome-card" data-testid="welcome-open-folder">
          <h3><FolderIcon size={18} /> 打开工作目录</h3>
          <p>当前: {cwd || '未设置'}</p>
          <button type="button" onClick={() => void pickWorkspace()}>切换目录 (Cmd+Shift+O)</button>
        </div>
        <div className="welcome-card" data-testid="welcome-shortcuts">
          <h3><KeyboardIcon size={18} /> 快捷键</h3>
          <ul>
            <li><kbd>Cmd+Shift+P</kbd> 命令面板</li>
            <li><kbd>Cmd+P</kbd> 快速打开文件</li>
            <li><kbd>Cmd+S</kbd> 保存当前文件</li>
            <li><kbd>Cmd+Enter</kbd> 发送消息</li>
          </ul>
        </div>
      </div>
    </main>
  )
}