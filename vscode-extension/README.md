# Claude SDK Agent — VSCode Sidebar

把 Claude SDK Agent 的聊天侧栏搬进 VSCode。扩展通过本地 HTTP 服务复用 Electron runtime 的全部能力（流式对话、权限对话框、工具调用、会话历史、配置面板）。

## 先决条件

1. **Electron runtime 已启动**：在另一个终端运行仓库根目录的 `npm run dev`（默认监听 `http://127.0.0.1:17361`）。
2. **VSCode ≥ 1.85**。

## 开发模式

```bash
cd vscode-extension
npm install
npm run watch        # 监听 src 变化并编译到 out/
```

然后在 VSCode 中：
- 按 F5 启动 Extension Development Host
- 点击左侧活动栏的机器人图标
- 侧栏出现「Claude Agent」面板

## 打包与安装

```bash
cd vscode-extension
npm run package      # 生成 .vsix
code --install-extension claude-sdk-agent-vscode-0.1.0.vsix
```

## 端口配置

VSCode 设置：`claude-sdk-agent.runtimePort`（默认 17361）。Electron runtime 端口需与之保持一致。

## 架构

```
┌──────────────────────────┐                  ┌──────────────────────────┐
│ VSCode + 扩展            │  postMessage       │ Electron Runtime         │
│ - Sidebar Webview        │ ◄──────────────►   │ - AgentService           │
│ - extension.ts           │   fetch + SSE      │ - PermissionBridge      │
│   (HTTP client + SSE)    │  :17361/events     │ - SessionStore          │
└──────────────────────────┘                  │ - httpServer.ts          │
                                              └──────────────────────────┘
```

通信渠道：
- Webview → Extension → Runtime：`postMessage({ type: 'invoke', channel, payload })` → `fetch POST /invoke`
- Runtime → Extension → Webview：`SSE event: <channel>` → `postMessage({ type: 'event', channel, payload })`