import type { MemoryEntry, MemoryKind } from '@shared/types'
import type { WebContentsLike } from '../ipc-interfaces'
import type { MemoryStore } from './MemoryStore'

/**
 * 记忆召回注入器（spec: memory-injection）。
 *
 * 回合启动时（AgentService.start 的 buildSystemPromptAppend 接缝）：
 * 作用域过滤 → 确定性打分（tag 重叠 ×2 + confidence + 新近度）→ 限额截取
 * → 组装 <memory> 段注入 system prompt，并发 memory:recalled 事件供内联展示。
 * 无 embedding——离线可测、任意模型可用。
 */
export interface MemoryInjectorOptions {
  store: MemoryStore
  win: WebContentsLike
  /** 实时读取当前会话 id（事件信封用；未捕获时事件 sessionId 为 ''） */
  currentSessionId: () => string | null
  /** 非 skill 条目上限（默认 12） */
  maxEntries?: number
  /** skill 条目上限（默认 4） */
  maxSkills?: number
  /** 组装后字符预算（默认 2000） */
  maxChars?: number
}

const SECTION_TITLES: Partial<Record<MemoryKind, string>> = {
  preference: '## Preferences',
  fact: '## Facts',
  lesson: '## Lessons',
  skill: '## Skills'
}

/** 新近度加成：30 天半衰期的 [0,1] 衰减 */
function recencyBonus(entry: MemoryEntry, now: number): number {
  const age = Math.max(0, now - entry.updatedAt)
  return Math.exp(-age / (30 * 24 * 60 * 60 * 1000))
}

export class MemoryInjector {
  private readonly maxEntries: number
  private readonly maxSkills: number
  private readonly maxChars: number

  constructor(private readonly options: MemoryInjectorOptions) {
    this.maxEntries = options.maxEntries ?? 12
    this.maxSkills = options.maxSkills ?? 4
    this.maxChars = options.maxChars ?? 2000
  }

  /** 选取并组装 append；空选返回 '' 且不发事件（AC-1） */
  async buildAppend(ctx: { cwd: string; firstText: string }): Promise<string> {
    let entries: MemoryEntry[]
    try {
      entries = await this.options.store.list()
    } catch {
      // 记忆库读取失败绝不阻塞回合启动（AC-6）
      return ''
    }

    const candidates = entries.filter((e) => this.inScope(e, ctx.cwd))
    if (candidates.length === 0) return ''

    const now = Date.now()
    const scored = candidates
      .map((e) => ({ e, score: this.score(e, ctx.firstText, now) }))
      .sort((a, b) => b.score - a.score)

    const selected: MemoryEntry[] = []
    let used = 0
    let nonSkill = 0
    let skills = 0
    for (const { e } of scored) {
      const cap = e.kind === 'skill' ? this.maxSkills : this.maxEntries
      const count = e.kind === 'skill' ? skills : nonSkill
      if (count >= cap) continue
      const line = this.line(e)
      if (used + line.length > this.maxChars && selected.length > 0) break
      selected.push(e)
      used += line.length
      if (e.kind === 'skill') skills++
      else nonSkill++
    }
    if (selected.length === 0) return ''

    const append = this.compose(selected)
    if (!append) return ''

    this.emitRecalled(selected)
    return append
  }

  /** global 恒候选；project 需 cwd 等于当前 cwd 或为其祖先目录（AC-2） */
  private inScope(entry: MemoryEntry, cwd: string): boolean {
    if (entry.scope === 'global') return true
    if (entry.scope !== 'project' || !entry.cwd) return false
    return cwd === entry.cwd || cwd.startsWith(`${entry.cwd}/`) || entry.cwd.startsWith(`${cwd}/`)
  }

  /** tag 与首条消息的重叠 ×2 + confidence + 新近度（AC-3） */
  private score(entry: MemoryEntry, firstText: string, now: number): number {
    const text = firstText.toLowerCase()
    const overlap = entry.tags.filter((t) => t && text.includes(t.toLowerCase())).length
    return overlap * 2 + entry.confidence + recencyBonus(entry, now)
  }

  /** 单条目渲染行（skill 为程序性格式，AC-4） */
  private line(entry: MemoryEntry): string {
    if (entry.kind === 'skill') {
      return `- When ${entry.tags.join(', ')}: ${entry.content}`
    }
    return `- ${entry.content}`
  }

  /** 组装 <memory> 段；空分区省略（AC-4） */
  private compose(selected: MemoryEntry[]): string {
    const order: MemoryKind[] = ['preference', 'fact', 'lesson', 'skill']
    const sections: string[] = []
    for (const kind of order) {
      const items = selected.filter((e) => e.kind === kind)
      if (items.length === 0) continue
      sections.push(`${SECTION_TITLES[kind]}\n${items.map((e) => this.line(e)).join('\n')}`)
    }
    if (sections.length === 0) return ''
    return [
      '<memory>',
      'Durable memories distilled from previous sessions with this user/project.',
      'Background context only — may be stale; trust current observations over these.',
      ...sections,
      '</memory>'
    ].join('\n')
  }

  /** query 启动前发出（渲染层时序：提问 → 召回块 → 回答）（AC-5） */
  private emitRecalled(selected: MemoryEntry[]): void {
    if (this.options.win.isDestroyed()) return
    this.options.win.send('memory:recalled', {
      sessionId: this.options.currentSessionId() ?? '',
      source: 'app',
      memories: selected.map((e) => ({ id: e.id, kind: e.kind, content: e.content }))
    })
  }
}
