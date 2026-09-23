import type { PermissionMode, PermissionUpdate, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/** 会话运行状态 */
export type AgentStatus = 'idle' | 'running' | 'error'

/** agent:message 的信封 —— 渲染层按 seq 排序/去重 */
export interface AgentEnvelope {
  sessionId: string
  /** 单调递增序号，同一 AgentService 生命周期内唯一 */
  seq: number
  message: SDKMessage
}

/** agent:status 事件载荷 */
export interface AgentStatusEvent {
  sessionId: string
  status: AgentStatus
  costUsd?: number
  durationMs?: number
  /** token 用量（spec: context-engineering，来自 SDKResultMessage.usage） */
  usage?: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  }
  numTurns?: number
}

/** agent:error 事件载荷 */
export interface AgentErrorEvent {
  sessionId: string
  error: string
}

/** permission:request 事件载荷（canUseTool 桥接） */
export interface PermissionRequest {
  id: string
  toolName: string
  input: Record<string, unknown>
  suggestions?: PermissionUpdate[]
  blockedPath?: string
  decisionReason?: string
  /** 桥接层渲染的完整提示句（如 "Claude wants to read foo.txt"） */
  title?: string
  displayName?: string
  description?: string
}

/** permission:respond 决议 —— SDK PermissionResult 的 IPC 可序列化子集 */
export interface PermissionDecision {
  behavior: 'allow' | 'deny'
  message?: string
  updatedInput?: Record<string, unknown>
  updatedPermissions?: PermissionUpdate[]
}

/** 会话索引条目（完整转录由 SDK 自身持久化） */
export interface SessionSummary {
  id: string
  title: string
  cwd: string
  createdAt: number
  updatedAt: number
}

/** 文件树节点（编辑器功能） */
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

/** 文件读取结果（含元数据，便于 UI 决定如何呈现） */
export interface FileContent {
  /** 文本内容；二进制或过大时可能为空字符串 */
  content: string
  /** 文件字节数 */
  size: number
  /** 最后修改时间（epoch ms） */
  mtime: number
  /** 检测到空字节 → 二进制 */
  isBinary: boolean
  /** 超过 MAX_INLINE_BYTES → 不打开编辑器，只读元数据 */
  isTooLarge: boolean
}

/** 应用配置 —— 由 config:get 返回，反映 AgentService 当前真实状态（spec: app-config） */
export interface AppConfig {
  /** 当前工作目录（AgentService 实际使用的 cwd） */
  cwd: string
  /** 当前权限模式 */
  permissionMode: PermissionMode
  /** 当前模型标识 */
  model: string
  /** fake = APP_AGENT_MODE=fake（E2E/离线开发） */
  agentMode: 'real' | 'fake'
}

/** 工作区（spec: workspace-management） */
export interface Workspace {
  /** path 的 stable hash */
  id: string
  path: string
  name: string
  lastOpenedAt: number
}

/** 单个工作区的视图状态（spec: workspace-management） */
export interface WorkspaceViewState {
  activeSessionId?: string
  openFilePaths?: string[]
  sidebarTab?: string
  chatInputDraft?: string
}

/** Composer 中 @ 提及的附件（spec: file-context-mentions） */
export interface MentionAttachment {
  type: 'file' | 'folder' | 'range'
  id: string
  path: string
  label: string
  range?: { startLine: number; endLine: number }
}

/** SearchPanel 单条结果（spec: sidebar-registry） */
export interface SearchResult {
  path: string
  line: number
  preview: string
}

/** GitPanel 状态（spec: sidebar-registry） */
export interface GitStatus {
  branch: string
  files: Array<{ path: string; status: 'M' | 'A' | 'D' | 'R' | '?' }>
}

/** GitPanel 单条 commit（spec: sidebar-registry） */
export interface GitCommit {
  sha: string
  message: string
  date: number
}

/** 记忆种类：语义记忆（fact/preference/lesson）+ 程序性记忆（skill）（spec: memory-core） */
export type MemoryKind = 'fact' | 'preference' | 'lesson' | 'skill'

/** 记忆作用域：global 跨项目；project 锚定到单一 cwd */
export type MemoryScope = 'global' | 'project'

/** 单条记忆（spec: memory-core） */
export interface MemoryEntry {
  /** `${kind}-${createdAt36}-${rand4}` */
  id: string
  kind: MemoryKind
  scope: MemoryScope
  /** project 作用域锚点；global 为 null */
  cwd: string | null
  /** 蒸馏语句（建议 ≤200 字符，硬上限 500） */
  content: string
  /** 0..1，新条目 0.6；重复确认 +0.15（上限 0.99） */
  confidence: number
  /** 被再次确认次数 */
  hits: number
  /** 主题关键词；skill 的触发条件 */
  tags: string[]
  /** 来源会话 id */
  sourceSessionId: string
  createdAt: number
  updatedAt: number
}

/** memory:recalled 事件载荷（app 注入路径，spec: memory-injection） */
export interface MemoryRecalledEvent {
  /** 会话 id 未捕获时为 ''（与 agent:message 约定一致） */
  sessionId: string
  source: 'app'
  memories: Array<{ id: string; kind: MemoryKind; content: string }>
}

/** memory:distilled 事件载荷（spec: memory-distillation） */
export interface MemoryDistilledEvent {
  sessionId: string
  added: number
  updated: number
  retired: number
}
