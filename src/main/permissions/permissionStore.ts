import type { PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'

/**
 * 主进程权限规则存储（permission-approval spec AC-6）。
 *
 * 持久化"总是允许"的规则：每次用户选择 alwaysAllow 时记下来，
 * 后续 canUseTool 调用先匹配本存储，命中则直接放行不弹窗。
 *
 * 规则以 toolName 为键，patterns 为该工具下允许的输入模式列表。
 * 简单实现：toolName 完全匹配 + 任一 input 字段完全匹配即视为命中。
 */

interface Rule {
  toolName: string
  /** allowed input 字段精确匹配的快照（典型如 { file_path: '/abs/path' }） */
  patterns: Array<Record<string, unknown>>
}

const STORAGE_PATH = '/tmp/claude-sdk-agent-permissions.json' // 简易持久化
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

export class PermissionStore {
  private rules: Map<string, Rule> = new Map()

  constructor() {
    void this.load()
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(STORAGE_PATH, 'utf-8')
      const arr = JSON.parse(raw) as Rule[]
      this.rules = new Map(arr.map((r) => [r.toolName, r]))
    } catch {
      // ignore — first run
    }
  }

  private async save(): Promise<void> {
    try {
      await mkdir(dirname(STORAGE_PATH), { recursive: true })
      await writeFile(STORAGE_PATH, JSON.stringify([...this.rules.values()], null, 2), 'utf-8')
    } catch {
      // best-effort
    }
  }

  /** 检查是否可以自动放行（命中已存的总是允许规则） */
  isAllowed(toolName: string, input: Record<string, unknown> | undefined): boolean {
    const rule = this.rules.get(toolName)
    if (!rule) return false
    return rule.patterns.some((p) => deepEqual(p, input ?? {}))
  }

  /** 记录"总是允许"规则 */
  async grant(toolName: string, input: Record<string, unknown> | undefined): Promise<void> {
    const pattern = input ?? {}
    const existing = this.rules.get(toolName)
    if (existing) {
      if (!existing.patterns.some((p) => deepEqual(p, pattern))) {
        existing.patterns.push(pattern)
      }
    } else {
      this.rules.set(toolName, { toolName, patterns: [pattern] })
    }
    await this.save()
  }

  /** 获取所有规则（调试用） */
  list(): Rule[] {
    return [...this.rules.values()]
  }

  /** 撤销某工具的总是允许 */
  async revoke(toolName: string): Promise<void> {
    this.rules.delete(toolName)
    await this.save()
  }

  /** SDK PermissionUpdate 转换（用于在 canUseTool 中预先放行） */
  toPermissionUpdates(): PermissionUpdate[] {
    const updates: PermissionUpdate[] = []
    for (const rule of this.rules.values()) {
      for (const pattern of rule.patterns) {
        updates.push({
          type: 'addRules',
          rules: [
            {
              toolName: rule.toolName,
              ruleContent: String(
                (pattern as Record<string, unknown>).file_path ??
                  (pattern as Record<string, unknown>).command ??
                  (pattern as Record<string, unknown>).pattern ??
                  '*'
              )
            }
          ],
          behavior: 'allow',
          destination: 'session'
        })
      }
    }
    return updates
  }
}

export const permissionStore = new PermissionStore()