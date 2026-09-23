import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { InvokeChannel, InvokeHandlerMap } from '@shared/ipc'
import { handleInvoke } from './ipc'
import type { WebContentsLike } from './ipc-interfaces'
import { AgentService } from './agent/AgentService'
import type { QueryFactory } from './agent/AgentService'
import { PermissionBridge } from './agent/PermissionBridge'
import { createFakeQueryFactory } from './agent/FakeAgent'
import { SessionStore, titleFromFirstMessage } from './sessions/SessionStore'
import { FileService } from './files/fileService'
import { FileWatcher } from './files/fileWatcher'
import { WorkspaceStore } from './workspace/WorkspaceStore'
import { assembleContext } from './contextAssembler'
import { SearchService } from './search/searchService'
import { GitService } from './git/gitService'
import { MemoryStore } from './memory/MemoryStore'
import { MemoryInjector } from './memory/MemoryInjector'
import { MemoryDistiller } from './memory/MemoryDistiller'
import type { DistillQueryFactory } from './memory/MemoryDistiller'
import { createFakeDistillQueryFactory } from './agent/FakeDistiller'
import { permissionStore } from './permissions/permissionStore'
import { loadEnvOverrides } from './config/env'
import { createMenuTemplate } from './menu'
import { broadcastEvent, startHttpServer } from './httpServer'
import {
  query as sdkQuery,
  deleteSession as sdkDeleteSession,
  getSessionMessages as sdkGetSessionMessages
} from '@anthropic-ai/claude-agent-sdk'

let mainWindow: BrowserWindow | null = null
let agentService: AgentService | null = null
let permissionBridge: PermissionBridge | null = null
let sessionStore: SessionStore | null = null
let fileService: FileService | null = null
let fileWatcher: FileWatcher | null = null
let memoryStore: MemoryStore | null = null
let memoryDistiller: MemoryDistiller | null = null
let workspaceStore: WorkspaceStore | null = null
let activeSessionTitle: string | null = null

const isFakeMode = (): boolean => process.env.APP_AGENT_MODE === 'fake'
/** 记忆子系统总开关（spec: memory-core；'0' 关闭注入与蒸馏） */
const isMemoryEnabled = (): boolean => process.env.APP_MEMORY_ENABLED !== '0'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Strata Code',
    webPreferences: {
      // ESM preload 需要 sandbox: false（Electron ≥28）；上下文隔离保持开启
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, '../preload/index.mjs')
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // electron-vite dev server vs 打包产物
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(createMenuTemplate(mainWindow)))
}

function asWebContentsLike(broadcast?: (channel: string, payload: unknown) => void): WebContentsLike {
  const win = mainWindow!
  return {
    send: (channel: string, ...args: unknown[]) => {
      win.webContents.send(channel, ...args)
      broadcast?.(channel, args[0])
    },
    once: (event: string, listener: () => void) => {
      win.webContents.once(event as never, listener as never)
    },
    isDestroyed: () => win.isDestroyed() || win.webContents.isDestroyed()
  }
}

let httpServerHandle: { close: () => void } | null = null

async function registerIpcHandlers(): Promise<void> {
  const win = asWebContentsLike((channel, payload) => broadcastEvent(channel, payload))
  const cwd = app.getPath('home')

  const queryFactory: QueryFactory = isFakeMode()
    ? createFakeQueryFactory()
    : (params) => sdkQuery(params)

  permissionBridge = new PermissionBridge(win, permissionStore)
  sessionStore = new SessionStore(join(app.getPath('userData'), 'sessions.json'))
  fileService = new FileService(cwd)
  workspaceStore = new WorkspaceStore(join(app.getPath('userData'), 'workspaces.json'))
  // spec: file-watcher —— 监听当前工作区文件变更
  fileWatcher = new FileWatcher()
  fileWatcher.on('change', (e: { path: string; kind: 'change' | 'rename' }) => {
    win.send('file:changed', e)
  })
  fileWatcher.watch(cwd)
  memoryStore = new MemoryStore(join(app.getPath('userData'), 'memory.json'))
  const searchService = new SearchService()
  const gitService = new GitService()
  const memoryInjector = new MemoryInjector({
    store: memoryStore,
    win,
    currentSessionId: () => agentService?.currentSessionId ?? null
  })

  // 会话后蒸馏 harness 子循环（spec: memory-distillation）
  // fake 模式注入 canned 转录（真实 sdkGetSessionMessages 在 fake 模式必败）
  const distillQueryFactory: DistillQueryFactory = isFakeMode()
    ? createFakeDistillQueryFactory()
    : (params) => sdkQuery(params)
  memoryDistiller = new MemoryDistiller({
    store: memoryStore,
    win,
    queryFactory: distillQueryFactory,
    cwd: () => agentService?.currentCwd ?? cwd,
    readTranscript: isFakeMode()
      ? async () => [
          { type: 'user', message: { role: 'user', content: 'hi from fake transcript' } },
          { type: 'assistant', message: { role: 'assistant', content: 'echo' } }
        ]
      : (id) => sdkGetSessionMessages(id).catch(() => [])
  })

  // SDK 子进程环境：process.env + .env 覆盖（spec: agent-env-config）
  // 打包后优先 userData/.env；开发时项目根 .env
  const envOverrides = await loadEnvOverrides([
    join(app.getPath('userData'), '.env'),
    join(app.getAppPath(), '.env')
  ])
  const sdkEnv = { ...process.env, ...envOverrides }

  agentService = new AgentService(win, queryFactory, {
    cwd,
    permissionMode: 'default',
    canUseTool: permissionBridge.handler,
    env: sdkEnv,
    // 记忆注入（spec: memory-injection）：空选时返回 '' → 不携带 systemPrompt 键
    buildSystemPromptAppend: isMemoryEnabled()
      ? (ctx) => memoryInjector.buildAppend(ctx)
      : undefined,
    // 蒸馏触发（spec: memory-distillation）：fire-and-forget，绝不打扰主循环
    onRunComplete: isMemoryEnabled()
      ? (info) => void memoryDistiller?.onRunComplete(info)
      : undefined,
    onSessionStart: (sessionId) => {
      const title = activeSessionTitle ?? titleFromFirstMessage('New session')
      void sessionStore!.upsert({
        id: sessionId,
        title,
        cwd: agentService!.currentCwd,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
  })

  const handlers: InvokeHandlerMap = {
    'agent:send': async ({ sessionId, text, attachments }) => {
      activeSessionTitle = titleFromFirstMessage(text)
      const prompt = attachments?.length
        ? await assembleContext(text, attachments, fileService!)
        : text
      await agentService!.send(prompt, sessionId ? { resume: sessionId } : undefined)
    },
    'agent:interrupt': async () => {
      await agentService!.interrupt()
    },
    'agent:setPermissionMode': async ({ mode }) => {
      await agentService!.setPermissionMode(mode)
    },
    'permission:respond': async ({ id, decision }) => {
      permissionBridge!.respond(id, decision)
    },
    'sessions:list': async () => sessionStore!.list(),
    'sessions:read': async ({ id }) => {
      try {
        return await sdkGetSessionMessages(id)
      } catch {
        // 转录不存在/读取失败 → 空历史，不阻塞打开会话
        return []
      }
    },
    'sessions:rename': async ({ id, title }) => sessionStore!.rename(id, title),
    'sessions:delete': async ({ id }) => {
      await sessionStore!.delete(id)
      try {
        await sdkDeleteSession(id)
      } catch {
        // SDK 转录可能不存在 —— 索引已删除即可
      }
    },
    'workspace:pick': async () => {
      const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
      return result.canceled ? null : result.filePaths[0] ?? null
    },
    'workspace:list': async () => workspaceStore!.list(),
    'workspace:open': async ({ path }) => {
      agentService!.setCwd(path)
      fileService!.setRoot(path)
      const ws = await workspaceStore!.upsert(path)
      await workspaceStore!.addOpen(ws.id)
      await workspaceStore!.setActive(ws.id)
      fileWatcher!.watch(path)
      win.send('workspace:changed', { cwd: path })
      return ws
    },
    'workspace:close': async ({ id }) => {
      await workspaceStore!.removeOpen(id)
      const { activeId } = await workspaceStore!.list()
      return { activeId }
    },
    'workspace:switch': async ({ id }) => {
      const { workspaces } = await workspaceStore!.list()
      const ws = workspaces.find((w) => w.id === id)
      if (!ws) throw new Error(`workspace not found: ${id}`)
      agentService!.setCwd(ws.path)
      fileService!.setRoot(ws.path)
      await workspaceStore!.setActive(id)
      fileWatcher!.watch(ws.path)
      win.send('workspace:changed', { cwd: ws.path })
      return workspaceStore!.getState(id)
    },
    'workspace:updateState': async ({ id, state }) => {
      await workspaceStore!.updateState(id, state)
    },
    'config:get': async () => ({
      cwd: agentService!.currentCwd,
      permissionMode: agentService!.currentPermissionMode,
      model: agentService!.currentModel ?? 'default',
      agentMode: isFakeMode() ? 'fake' : 'real'
    }),
    'config:set': async ({ cwd: newCwd, model }) => {
      if (newCwd !== undefined) {
        agentService!.setCwd(newCwd)
        fileService!.setRoot(newCwd)
        const ws = await workspaceStore!.upsert(newCwd)
        await workspaceStore!.setActive(ws.id)
        fileWatcher!.watch(newCwd)
        win.send('workspace:changed', { cwd: newCwd })
      }
      if (model !== undefined) agentService!.setModel(model)
    },
    'session:export': async ({ content, defaultName }) => {
      const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: defaultName })
      if (result.canceled || !result.filePath) return
      await writeFile(result.filePath, content, 'utf-8')
    },
    'file:list': async ({ path, depth }) => {
      // fallback 跟随当前 workspace root（不能用注册时捕获的 cwd，会与 setRoot 失同步）
      return fileService!.list(path || fileService!.getRoot(), depth ?? 2)
    },
    'file:read': async ({ path }) => {
      return fileService!.read(path)
    },
    'file:write': async ({ path, content }) => {
      fileWatcher!.markOwnWrite(path)
      await fileService!.write(path, content)
    },
    'file:create': async ({ path, content }) => {
      await fileService!.create(path, content)
    },
    'file:mkdir': async ({ path }) => {
      await fileService!.mkdirDir(path)
    },
    'file:rename': async ({ from, to }) => {
      await fileService!.renamePath(from, to)
    },
    'file:delete': async ({ path }) => {
      await fileService!.deletePath(path)
    },
    'memory:list': async ({ kind }) => {
      const entries = await memoryStore!.list()
      return kind ? entries.filter((e) => e.kind === kind) : entries
    },
    'memory:delete': async ({ id }) => {
      await memoryStore!.delete(id)
    },
    'search:files': async ({ path, query }) => {
      const root = path || cwd
      return searchService.search(root, query)
    },
    'git:status': async ({ path }) => {
      return gitService.status(path || cwd)
    },
    'git:diff': async ({ path, file }) => {
      return gitService.diff(path || cwd, file)
    },
    'git:log': async ({ path, limit }) => {
      return gitService.log(path || cwd, limit)
    }
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    handleInvoke(ipcMain, channel as InvokeChannel, handler as never)
  }

  // 启动 HTTP 服务，让外部客户端（如 VSCode 扩展）能复用 invoke handlers
  // spec: runtime-port-discovery —— 把实际端口写到 userData/agent-port.json
  httpServerHandle = await startHttpServer(handlers, 17361, join(app.getPath('userData'), 'agent-port.json'))

  app.on('before-quit', () => {
    permissionBridge?.denyAll()
    memoryDistiller?.dispose()
    void agentService?.dispose()
    fileWatcher?.dispose()
    httpServerHandle?.close()
    httpServerHandle = null
  })
}

app.whenReady().then(() => {
  createWindow()
  void registerIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  permissionBridge?.denyAll()
  void agentService?.dispose()
  // 所有平台（包括 macOS）都直接退出 —— 点击 X 完全退出应用
  app.quit()
})
