import type { Options, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { MemoryEntry } from '@shared/types'
import type { WebContentsLike } from '../ipc-interfaces'
import type { MemoryStore } from './MemoryStore'
import { mergeEntries, prune } from './merge'
import { buildDistillPrompt, extractJson, truncateMiddle, validateDrafts } from './distillPrompt'

/** 一次性字符串 prompt 的侧查询工厂（与主会话流式输入不同形） */
export type DistillQueryFactory = (params: {
  prompt: string
  options: Options
}) => Query

/** onRunComplete 载荷（与 AgentService.RunCompleteInfo 同形） */
export interface RunCompleteInfo {
  sessionId: string
  numTurns: number
  costUsd: number
  durationMs: number
}

export interface MemoryDistillerOptions {
  store: MemoryStore
  queryFactory: DistillQueryFactory
  win: WebContentsLike
  /** 实时读取当前工作目录 */
  cwd: () => string
  /** 会话转录读取（sdkGetSessionMessages 包装；fake 模式注入 canned 转录） */
  readTranscript: (sessionId: string) => Promise<unknown[]>
  /** 蒸馏触发门槛（默认 2） */
  minTurns?: number
  /** 转录中段截断上限（默认 24000 字符） */
  maxTranscriptChars?: number
}

/** 蒸馏侧查询的 systemPrompt 追加段（约束输出为纯 JSON） */
const DISTILLER_APPEND = `You are running as a headless memory-distillation sub-agent.
Output STRICT JSON only. Do not use tools. Do not ask questions.`

/**
 * 会话后蒸馏 harness 子循环（spec: memory-distillation）。
 *
 * onRunComplete 触发 → 读转录 → 一次性侧查询提取提案 → 窄校验 →
 * 纯函数巩固（mergeEntries+prune）→ store.replace → memory:distilled 事件。
 * 侧查询与主会话物理隔离（无 resume/canUseTool/PromptQueue）；
 * 每步失败 log-and-stop，绝不影响主循环。
 */
export class MemoryDistiller {
  private readonly minTurns: number
  private readonly maxTranscriptChars: number
  /** sessionId → in-flight Promise（AC-7 去重） */
  private readonly inFlight = new Map<string, Promise<void>>()
  /** 在途侧查询的 AbortController（dispose 时中止，AC-9） */
  private readonly aborts = new Set<AbortController>()
  private disposed = false

  constructor(private readonly options: MemoryDistillerOptions) {
    this.minTurns = options.minTurns ?? 2
    this.maxTranscriptChars = options.maxTranscriptChars ?? 24_000
  }

  /** 永不抛出（AC-8） */
  async onRunComplete(info: RunCompleteInfo): Promise<void> {
    if (this.disposed) return
    if (info.numTurns < this.minTurns) return // AC-1
    if (this.inFlight.has(info.sessionId)) return // AC-7

    const run = this.distill(info).catch(() => {
      // log-and-stop：蒸馏失败绝不打扰主会话
    })
    this.inFlight.set(info.sessionId, run)
    try {
      await run
    } finally {
      this.inFlight.delete(info.sessionId)
    }
  }

  /** 中止在途侧查询（before-quit 调用，AC-9） */
  dispose(): void {
    this.disposed = true
    for (const controller of this.aborts) controller.abort()
    this.aborts.clear()
  }

  private async distill(info: RunCompleteInfo): Promise<void> {
    // 1. 读转录（空/异常 → 跳过，AC-2）
    let transcript: unknown[]
    try {
      transcript = await this.options.readTranscript(info.sessionId)
    } catch {
      return
    }
    if (!Array.isArray(transcript) || transcript.length === 0) return

    // 2. 序列化 + 中段截断（AC-3）
    let transcriptText: string
    try {
      transcriptText = JSON.stringify(
        transcript.map((m) => {
          const msg = m as { type?: string; message?: { role?: string; content?: unknown } }
          // 只保留对话骨架，剥离流式/系统噪声，控制体积
          return { type: msg.type, role: msg.message?.role, content: msg.message?.content }
        })
      )
    } catch {
      transcriptText = String(transcript)
    }
    transcriptText = truncateMiddle(transcriptText, this.maxTranscriptChars)

    // 3. 现有候选条目（供 retire 提案；读取失败按空处理）
    let existing: MemoryEntry[] = []
    try {
      existing = await this.options.store.list()
    } catch {
      existing = []
    }

    // 4. 一次性侧查询（AC-4）
    const abortController = new AbortController()
    this.aborts.add(abortController)
    const options: Options = {
      cwd: this.options.cwd(),
      maxTurns: 1,
      permissionMode: 'default',
      abortController,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: DISTILLER_APPEND }
    }
    let lastAssistantText = ''
    try {
      const query = this.options.queryFactory({
        prompt: buildDistillPrompt(transcriptText, existing),
        options
      })
      for await (const message of query) {
        const text = assistantText(message)
        if (text) lastAssistantText = text
        if (this.disposed) return
      }
    } finally {
      this.aborts.delete(abortController)
    }

    if (this.disposed) return

    // 5. 解析 + 窄校验（AC-5）
    const parsed = extractJson(lastAssistantText)
    if (!parsed) return
    const { add, retire } = validateDrafts(parsed, info.sessionId, Date.now())

    // 6. 纯函数巩固 + 原子提交（AC-5）
    const now = Date.now()
    const merged = mergeEntries(existing, add, retire, now)
    const entries = prune(merged.entries)
    await this.options.store.replace(entries)

    // 7. 事件（AC-6）
    if (!this.options.win.isDestroyed()) {
      this.options.win.send('memory:distilled', {
        sessionId: info.sessionId,
        added: merged.added,
        updated: merged.updated,
        retired: merged.retired
      })
    }
  }
}

/** 从 assistant 消息提取末条文本块 */
function assistantText(message: SDKMessage): string {
  if (message.type !== 'assistant') return ''
  const content = (message as unknown as { message?: { content?: unknown[] } }).message?.content
  if (!Array.isArray(content)) return ''
  const blocks = content as Array<{ type?: string; text?: string }>
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  return text.trim()
}
