import * as vscode from 'vscode'

/**
 * Claude SDK Agent VSCode 扩展。
 *
 * 通信协议：
 * - Webview → Extension：`postMessage({ type: 'invoke', channel, payload })`
 * - Extension → HTTP Runtime：`POST http://127.0.0.1:${port}/invoke`
 * - Runtime → Extension：`GET http://127.0.0.1:${port}/events` (SSE)
 * - Extension → Webview：`postMessage({ type: 'event', channel, payload })`
 */

const DEFAULT_PORT = 17361

export function activate(context: vscode.ExtensionContext): void {
  const provider = new AgentSidebarProvider(context)
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('claude-sdk-agent.sidebar', provider))

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-sdk-agent.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.claude-sdk-agent-container')
    })
  )
}

export function deactivate(): void {}

class AgentSidebarProvider implements vscode.WebviewViewProvider {
  private sseAbort: AbortController | null = null
  private readonly port: number

  constructor(private readonly context: vscode.ExtensionContext) {
    this.port = (vscode.workspace.getConfiguration('claude-sdk-agent').get<number>('runtimePort') ?? DEFAULT_PORT)
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    const webview = webviewView.webview
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    }

    webview.html = this.renderHtml(webview)

    webview.onDidReceiveMessage(async (msg: { type: string; channel?: string; payload?: unknown }) => {
      if (msg.type === 'invoke' && msg.channel) {
        try {
          const res = await fetch(`http://127.0.0.1:${this.port}/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: msg.channel, payload: msg.payload })
          })
          const data = (await res.json()) as { result?: unknown; error?: string }
          webview.postMessage({ type: 'invoke-result', id: (msg as { id?: string }).id, ...data })
        } catch (err) {
          webview.postMessage({
            type: 'invoke-result',
            id: (msg as { id?: string }).id,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }
    })

    this.startSseSubscription(webview)
  }

  private startSseSubscription(webview: vscode.Webview): void {
    this.sseAbort?.abort()
    this.sseAbort = new AbortController()
    const signal = this.sseAbort.signal

    void (async () => {
      while (!signal.aborted) {
        try {
          const res = await fetch(`http://127.0.0.1:${this.port}/events`, { signal })
          if (!res.body) return
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          while (!signal.aborted) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const frames = buffer.split('\n\n')
            buffer = frames.pop() ?? ''
            for (const frame of frames) {
              const eventLine = frame.split('\n').find((l) => l.startsWith('event: '))
              const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))
              if (!eventLine || !dataLine) continue
              const channel = eventLine.slice(7).trim()
              const data = dataLine.slice(6).trim()
              if (channel.startsWith(':')) continue // comment / keep-alive
              try {
                const payload = JSON.parse(data)
                webview.postMessage({ type: 'event', channel, payload })
              } catch {
                // skip malformed
              }
            }
          }
        } catch (err) {
          if (signal.aborted) return
          // 等待后重连
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    })()
  }

  private renderHtml(webview: vscode.Webview): string {
    const csp = webview.cspSource
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${csp}; style-src 'unsafe-inline' ${csp};">
  <title>Claude Agent</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, sans-serif; padding: 12px; font-size: 13px; }
    .empty { color: var(--vscode-descriptionForeground); text-align: center; margin-top: 20px; }
    .msg { padding: 6px 8px; border-radius: 6px; margin: 6px 0; white-space: pre-wrap; word-break: break-word; }
    .msg.user { background: var(--vscode-inputOption-activeBackground); }
    .msg.assistant { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }
    .msg.error { background: rgba(255,107,107,0.15); color: var(--vscode-errorForeground); }
    .tool { padding: 4px 8px; border-left: 3px solid var(--vscode-focusBorder); margin: 4px 0; font-family: monospace; font-size: 12px; }
    .composer { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    textarea { width: 100%; min-height: 60px; resize: vertical; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 6px; font-family: inherit; font-size: 12px; }
    button { padding: 4px 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="status">未连接</div>
  <div id="messages"></div>
  <div class="composer">
    <textarea id="input" placeholder="向 Claude 描述任务…"></textarea>
    <button id="send">发送</button>
  </div>
  <script>
    (function () {
      const statusEl = document.getElementById('status')
      const messagesEl = document.getElementById('messages')
      const inputEl = document.getElementById('input')
      const sendBtn = document.getElementById('send')

      function setStatus(text) { statusEl.textContent = text }

      function append(kind, text) {
        const div = document.createElement('div')
        div.className = 'msg ' + kind
        div.textContent = text
        messagesEl.appendChild(div)
        div.scrollIntoView({ block: 'end' })
      }

      function appendTool(name, status) {
        const div = document.createElement('div')
        div.className = 'tool'
        div.textContent = '🔧 ' + name + ' (' + status + ')'
        messagesEl.appendChild(div)
      }

      const vscode = acquire ? acquire : undefined
      // 通过 postMessage 与 extension 通信
      const post = (msg) => window.parent.postMessage(msg, '*')
      let invokeId = 0
      const pending = new Map()
      window.addEventListener('message', (e) => {
        const msg = e.data
        if (!msg) return
        if (msg.type === 'invoke-result') {
          const p = pending.get(msg.id)
          if (p) { pending.delete(msg.id); p.resolve(msg) }
          return
        }
        if (msg.type === 'event') {
          handleEvent(msg.channel, msg.payload)
        }
      })

      function invoke(channel, payload) {
        const id = 'i' + (++invokeId)
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject })
          post({ type: 'invoke', id, channel, payload })
        })
      }

      function handleEvent(channel, payload) {
        if (channel === 'agent:status') {
          if (payload.status === 'running') setStatus('运行中')
          else if (payload.status === 'error') setStatus('出错')
          else setStatus('空闲')
          return
        }
        if (channel === 'agent:error') {
          append('error', '错误: ' + (payload.error || ''))
          return
        }
        if (channel === 'agent:message') {
          const m = payload && payload.message
          if (!m) return
          if (m.type === 'assistant') {
            const text = m.message && m.message.content && m.message.content[0] && m.message.content[0].text
            if (text) append('assistant', text)
          } else if (m.type === 'user' && Array.isArray(m.message && m.message.content) && m.message.content[0]) {
            const b = m.message.content[0]
            if (b.type === 'tool_result') {
              // ignore for brevity
            }
          }
        }
      }

      sendBtn.addEventListener('click', async () => {
        const text = inputEl.value.trim()
        if (!text) return
        inputEl.value = ''
        append('user', text)
        await invoke('agent:send', { text })
      })

      // 健康检查
      fetch('http://127.0.0.1:17361/health').then((r) => r.json()).then((j) => {
        setStatus('已连接 (' + j.clients + ' 客户端)')
      }).catch(() => setStatus('未连接 — 请启动 Electron runtime'))
    })()
  </script>
</body>
</html>`
  }
}