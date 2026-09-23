import type { PermissionMode, SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentEnvelope,
  AgentErrorEvent,
  AgentStatusEvent,
  AppConfig,
  FileContent,
  FileNode,
  GitCommit,
  GitStatus,
  MemoryDistilledEvent,
  MemoryEntry,
  MemoryKind,
  MemoryRecalledEvent,
  MentionAttachment,
  PermissionDecision,
  PermissionRequest,
  SearchResult,
  SessionSummary,
  Workspace,
  WorkspaceViewState
} from './types'

/**
 * IPC 通道契约 —— 单一事实源（纯类型层）。
 * 主进程（handleInvoke）、preload（透传）、渲染进程（api client）三方共享，
 * 拼错通道名或载荷类型不匹配 = 编译错误。
 *
 * 约定：载荷必须可结构化克隆（纯数据，不含函数/Class 实例）。
 */

/** 渲染进程 → 主进程（request/response，返回 Promise） */
export interface InvokeChannels {
  /** 发送用户消息；sessionId 存在则恢复该会话，否则新对话 */
  'agent:send': (p: { sessionId?: string; text: string; attachments?: MentionAttachment[] }) => Promise<void>
  /** 中断当前回合 */
  'agent:interrupt': () => Promise<void>
  /** 切换权限模式 */
  'agent:setPermissionMode': (p: { mode: PermissionMode }) => Promise<void>
  /** 回应权限请求 */
  'permission:respond': (p: { id: string; decision: PermissionDecision }) => Promise<void>
  /** 会话索引列表（按 updatedAt 降序） */
  'sessions:list': () => Promise<SessionSummary[]>
  /** 读取会话历史消息（包装 SDK getSessionMessages，用于恢复时回放） */
  'sessions:read': (p: { id: string }) => Promise<SessionMessage[]>
  /** 会话重命名（仅索引） */
  'sessions:rename': (p: { id: string; title: string }) => Promise<void>
  /** 删除会话（索引 + SDK 转录） */
  'sessions:delete': (p: { id: string }) => Promise<void>
  /** 选择工作目录（系统对话框） */
  'workspace:pick': () => Promise<string | null>
  /** 列出所有工作区及当前打开/活跃状态（spec: workspace-management） */
  'workspace:list': () => Promise<{ workspaces: Workspace[]; openIds: string[]; activeId: string | null }>
  /** 打开/新建工作区（spec: workspace-management） */
  'workspace:open': (p: { path: string }) => Promise<Workspace>
  /** 关闭工作区（spec: workspace-management） */
  'workspace:close': (p: { id: string }) => Promise<{ activeId: string | null }>
  /** 切换活跃工作区（spec: workspace-management） */
  'workspace:switch': (p: { id: string }) => Promise<WorkspaceViewState>
  /** 更新工作区视图状态（spec: workspace-management） */
  'workspace:updateState': (p: { id: string; state: Partial<WorkspaceViewState> }) => Promise<void>
  /** 应用配置 */
  'config:get': () => Promise<AppConfig>
  /** 更新应用配置（cwd / model；permissionMode 走 agent:setPermissionMode） */
  'config:set': (p: { cwd?: string; model?: string }) => Promise<void>
  /** 导出会话内容（渲染层已格式化，主进程只负责保存文件） */
  'session:export': (p: { content: string; defaultName: string }) => Promise<void>
  /** 列出目录下文件与子目录 */
  'file:list': (p: { path: string; depth?: number }) => Promise<FileNode[]>
  /** 读取文件内容 */
  'file:read': (p: { path: string }) => Promise<FileContent>
  /** 写入文件内容 */
  'file:write': (p: { path: string; content: string }) => Promise<void>
  /** 创建新文件（可同时初始化内容） */
  'file:create': (p: { path: string; content?: string }) => Promise<void>
  /** 创建新目录 */
  'file:mkdir': (p: { path: string }) => Promise<void>
  /** 重命名或移动 */
  'file:rename': (p: { from: string; to: string }) => Promise<void>
  /** 删除文件或目录 */
  'file:delete': (p: { path: string }) => Promise<void>
  /** 记忆条目列表（可按 kind 过滤；spec: memory-core） */
  'memory:list': (p: { kind?: MemoryKind }) => Promise<MemoryEntry[]>
  /** 删除单条记忆 */
  'memory:delete': (p: { id: string }) => Promise<void>
  /** 全文搜索（spec: sidebar-registry） */
  'search:files': (p: { path: string; query: string }) => Promise<SearchResult[]>
  /** git 状态（spec: sidebar-registry） */
  'git:status': (p: { path: string }) => Promise<GitStatus>
  /** git diff（spec: sidebar-registry） */
  'git:diff': (p: { path: string; file?: string }) => Promise<string>
  /** git log（spec: sidebar-registry） */
  'git:log': (p: { path: string; limit?: number }) => Promise<GitCommit[]>
}

/** 主进程 → 渲染进程（单向事件） */
export interface EventChannels {
  'agent:message': (p: AgentEnvelope) => void
  'agent:status': (p: AgentStatusEvent) => void
  'agent:error': (p: AgentErrorEvent) => void
  'permission:request': (p: PermissionRequest) => void
  /** 工作区文件变更（spec: file-watcher） */
  'file:changed': (p: { path: string; kind: 'change' | 'rename' }) => void
  /** 回合启动时注入的记忆（spec: memory-injection） */
  'memory:recalled': (p: MemoryRecalledEvent) => void
  /** 会话后蒸馏完成（spec: memory-distillation） */
  'memory:distilled': (p: MemoryDistilledEvent) => void
  /** 当前工作目录切换（spec: workspace-foundation） */
  'workspace:changed': (p: { cwd: string }) => void
  'menu:new-chat': () => void
  'menu:open-workspace': () => void
  'menu:open-settings': () => void
  'menu:reload': () => void
  'menu:about': () => void
}

export type InvokeChannel = keyof InvokeChannels
export type EventChannel = keyof EventChannels

export type InvokePayload<C extends InvokeChannel> = Parameters<
  InvokeChannels[C]
>[0] extends undefined
  ? undefined
  : Parameters<InvokeChannels[C]>[0]
/** 保留 Promise 包装 —— handler 是 async 函数 */
export type InvokeResult<C extends InvokeChannel> = ReturnType<InvokeChannels[C]>
export type EventPayload<C extends EventChannel> = Parameters<EventChannels[C]>[0]

/** invoke handler 的类型 */
export type InvokeHandler<C extends InvokeChannel> = (
  payload: InvokePayload<C>
) => InvokeResult<C>

/** 全部 invoke handler 的注册表形态 */
export type InvokeHandlerMap = {
  [C in InvokeChannel]?: InvokeHandler<C>
}

/** 渲染进程暴露的 API 形态（preload contextBridge 两侧一致） */
export interface RendererApi {
  invoke<C extends InvokeChannel>(
    channel: C,
    ...payload: InvokePayload<C> extends undefined ? [] : [payload: InvokePayload<C>]
  ): Promise<InvokeResult<C>>
  on<C extends EventChannel>(channel: C, cb: (payload: EventPayload<C>) => void): () => void
}
