import type {
  Options,
  PermissionMode,
  Query,
  SDKMessage,
  SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { AgentStatus, AgentStatusEvent } from '@shared/types'
import type { WebContentsLike } from '../ipc-interfaces'
import { PromptQueue } from './PromptQueue'

/** 可注入的查询工厂 —— 测试 fake 与真实 SDK 的接缝 */
export type QueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  options: Options
}) => Query

export interface AgentServiceOptions {
  cwd: string
  permissionMode?: PermissionMode
  canUseTool?: Options['canUseTool']
  /**
   * SDK 子进程环境（spec: agent-env-config）。
   * 注意：SDK 的 options.env 会整体替换子进程环境 ——
   * 调用方必须传 { ...process.env, ...overrides }。
   */
  env?: Record<string, string | undefined>
  /** 每次查询启动时回调（携带 session id），供 SessionStore upsert */
  onSessionStart?: (sessionId: string) => void
  /** 显式 settings 来源（spec: context-engineering）。默认 ['user','project','local']（含 CLAUDE.md） */
  settingSources?: Options['settingSources']
  /**
   * 回合启动时组装 systemPrompt 追加段（spec: context-engineering）。
   * 返回非空 → options.systemPrompt = {type:'preset', preset:'claude_code', append}；
   * 返回空/未提供 → 不携带 systemPrompt 键（保持缓存前缀稳定）。
   * 注意：不设 snapshot —— append 每次启动重新生效（进化式记忆所需）。
   */
  buildSystemPromptAppend?: (ctx: { cwd: string; firstText: string }) => Promise<string>
  /** 回合正常结束（result 消息）时回调（spec: context-engineering，fire-and-forget） */
  onRunComplete?: (info: RunCompleteInfo) => void
}

/** 回合完成信息（onRunComplete 载荷） */
export interface RunCompleteInfo {
  sessionId: string
  numTurns: number
  costUsd: number
  durationMs: number
}

interface EmittedStatus {
  sessionId: string
  status: AgentStatus
  costUsd?: number
  durationMs?: number
  usage?: AgentStatusEvent['usage']
  numTurns?: number
}

/**
 * Agent 运行时核心：每个会话一个流式查询（spec: agent-service）。
 *
 * - 流式输入模式（PromptQueue）→ interrupt/setPermissionMode 中途可用
 * - 每条 SDKMessage 以 {sessionId, seq, message} 信封发出（seq 单调递增）
 * - result 消息 → idle + cost；异常 → agent:error + idle；dispose → abort
 */
export class AgentService {
  private query: Query | null = null
  private queue: PromptQueue | null = null
  private abortController: AbortController | null = null
  /** append 解析期间的启动重入守卫（spec: context-engineering AC-4） */
  private pendingStart = false
  private seq = 0
  private sessionId: string | null = null
  private disposed = false
  private _currentPermissionMode: PermissionMode
  private _currentModel: string | null = null

  constructor(
    private readonly win: WebContentsLike,
    private readonly queryFactory: QueryFactory,
    private readonly options: AgentServiceOptions
  ) {
    this._currentPermissionMode = options.permissionMode ?? 'default'
  }

  /** 当前 SDK 会话 id（未启动或未捕获时为 null） */
  get currentSessionId(): string | null {
    return this.sessionId
  }

  get isRunning(): boolean {
    return this.query !== null
  }

  /** 当前工作目录 */
  get currentCwd(): string {
    return this.options.cwd
  }

  /** 当前权限模式（包含运行中 setPermissionMode 的变更） */
  get currentPermissionMode(): PermissionMode {
    return this._currentPermissionMode
  }

  /** 当前模型（从 system init 消息捕获；未捕获前为 null） */
  get currentModel(): string | null {
    return this._currentModel
  }

  /**
   * 发送用户消息（AC-1）：运行中 → 推入同一输入流（多轮）；
   * 无查询 → 惰性启动。
   * - resume 指定历史会话；与当前会话不同（或当前无会话）时切换
   * - 无 resume 且已有会话 → 新对话（结束当前查询）
   */
  async send(text: string, opts?: { resume?: string }): Promise<void> {
    if (this.disposed) throw new Error('AgentService disposed')
    if (opts?.resume && opts.resume !== this.sessionId) {
      this.switchSession()
    } else if (!opts?.resume && this.sessionId && !this.query && !this.pendingStart) {
      // 新对话：从历史会话上下文切出
      this.switchSession()
    }
    if (this.query || this.pendingStart) {
      // 运行中或启动中（append 解析期间）→ 推入同一输入流（AC-4 重入守卫）
      this.queue!.push(text)
      return
    }
    await this.start(text, opts)
  }

  async interrupt(): Promise<void> {
    await this.query?.interrupt()
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    this._currentPermissionMode = mode
    await this.query?.setPermissionMode(mode)
  }

  /** 更新当前工作目录（后续新查询生效） */
  setCwd(cwd: string): void {
    this.options.cwd = cwd
  }

  /** 更新当前模型（后续新查询生效） */
  setModel(model: string): void {
    this._currentModel = model
  }

  /** 结束当前查询并回到空白会话（切换会话/新对话时调用） */
  switchSession(): void {
    this.endCurrentQuery()
    this.sessionId = null
  }

  /** 中止底层查询并清理（AC-8）—— 退出时调用，永久失效 */
  async dispose(): Promise<void> {
    this.disposed = true
    this.endCurrentQuery()
  }

  private endCurrentQuery(): void {
    this.pendingStart = false
    this.abortController?.abort()
    this.queue?.end()
    this.query = null
    this.queue = null
    this.abortController = null
  }

  private async start(firstText: string, opts?: { resume?: string }): Promise<void> {
    // 同步建 queue 并推入首条文本 —— append 解析期间到达的 send 能进入同一输入流（AC-4）
    this.pendingStart = true
    this.queue = new PromptQueue()
    this.queue.push(firstText)
    this.abortController = new AbortController()

    try {
      // append 解析（可能为异步，如读取记忆库）失败 → 与 factory 同步异常同路径（AC-5）
      const append = this.options.buildSystemPromptAppend
        ? await this.options.buildSystemPromptAppend({ cwd: this.options.cwd, firstText })
        : ''
      if (!this.pendingStart) return // append 期间被 dispose/切换

      const resume = opts?.resume ?? this.sessionId ?? undefined
      const options: Options = {
        cwd: this.options.cwd,
        resume,
        includePartialMessages: true,
        permissionMode: this._currentPermissionMode,
        abortController: this.abortController,
        settingSources: this.options.settingSources ?? ['user', 'project', 'local'],
        ...(this._currentModel ? { model: this._currentModel } : {}),
        ...(this.options.canUseTool ? { canUseTool: this.options.canUseTool } : {}),
        ...(this.options.env ? { env: this.options.env } : {}),
        // 空 append 不携带 systemPrompt 键（AC-3，保持缓存前缀稳定）
        ...(append
          ? { systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append } }
          : {})
      }

      try {
        this.query = this.queryFactory({ prompt: this.queue, options })
      } catch (error) {
        // factory 同步失败也必须走 error 路径（AC-5），不向上抛
        this.endCurrentQuery()
        this.emitError(error instanceof Error ? error.message : String(error))
        return
      }
      this.pendingStart = false
      this.emitStatus('running')
      void this.consume()
    } catch (error) {
      this.pendingStart = false
      this.endCurrentQuery()
      this.emitError(error instanceof Error ? error.message : String(error))
    }
  }

  private async consume(): Promise<void> {
    const query = this.query
    if (!query) return
    try {
      for await (const message of query) {
        if (this.query !== query) return // 已被 dispose/替换
        this.captureSessionId(message)
        this.emitMessage(message)
        const result = this.asResult(message)
        if (result) {
          this.emitStatus('idle', {
            costUsd: result.total_cost_usd,
            durationMs: result.duration_ms,
            ...(result.usage ? { usage: result.usage } : {}),
            ...(result.numTurns !== undefined ? { numTurns: result.numTurns } : {})
          })
          // fire-and-forget：绝不阻塞事件流（spec: context-engineering AC-6）
          this.options.onRunComplete?.({
            sessionId: this.sessionId ?? '',
            numTurns: result.numTurns ?? 0,
            costUsd: result.total_cost_usd,
            durationMs: result.duration_ms
          })
        }
      }
      // 生成器结束但没收到 result（容错）：确保离开 running 态
      if (this.query === query) {
        this.query = null
        this.queue = null
        this.abortController = null
        this.emitStatus('idle')
      }
    } catch (error) {
      if (this.query === query) {
        this.query = null
        this.queue = null
        this.abortController = null
        this.emitError(error instanceof Error ? error.message : String(error))
        this.emitStatus('idle')
      }
    }
  }

  /** 从消息中捕获 session id（AC-6）与模型 */
  private captureSessionId(message: SDKMessage): void {
    const withId = message as { session_id?: string }
    if (typeof withId.session_id === 'string' && withId.session_id) {
      if (this.sessionId !== withId.session_id) {
        this.sessionId = withId.session_id
        this.options.onSessionStart?.(this.sessionId)
      }
    }
    const withModel = message as { model?: string }
    if (typeof withModel.model === 'string' && withModel.model) {
      this._currentModel = withModel.model
    }
  }

  private asResult(
    message: SDKMessage
  ): {
    total_cost_usd: number
    duration_ms: number
    numTurns?: number
    usage?: AgentStatusEvent['usage']
  } | null {
    if (message.type === 'result') {
      const u = message.usage
      return {
        total_cost_usd: message.total_cost_usd,
        duration_ms: message.duration_ms,
        numTurns: message.num_turns,
        usage: u
          ? {
              inputTokens: u.input_tokens,
              outputTokens: u.output_tokens,
              ...(u.cache_read_input_tokens !== undefined
                ? { cacheReadTokens: u.cache_read_input_tokens }
                : {}),
              ...(u.cache_creation_input_tokens !== undefined
                ? { cacheCreationTokens: u.cache_creation_input_tokens }
                : {})
            }
          : undefined
      }
    }
    return null
  }

  private emitMessage(message: SDKMessage): void {
    if (this.win.isDestroyed()) return
    this.win.send('agent:message', {
      sessionId: this.sessionId ?? '',
      seq: ++this.seq,
      message
    })
  }

  private emitStatus(
    status: AgentStatus,
    extra?: { costUsd?: number; durationMs?: number; usage?: AgentStatusEvent['usage']; numTurns?: number }
  ): void {
    const payload: EmittedStatus = {
      sessionId: this.sessionId ?? '',
      status,
      ...extra
    }
    if (this.win.isDestroyed()) return
    this.win.send('agent:status', payload)
  }

  private emitError(error: string): void {
    if (this.win.isDestroyed()) return
    this.win.send('agent:error', { sessionId: this.sessionId ?? '', error })
  }
}
