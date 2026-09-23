import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'node:crypto'
import type { PermissionDecision } from '@shared/types'
import type { WebContentsLike } from '../ipc-interfaces'
import type { PermissionStore } from '../permissions/permissionStore'

interface PendingEntry {
  resolve: (result: PermissionResult) => void
  /** 移除 abort 监听器 */
  cleanup: () => void
  toolName: string
  input: Record<string, unknown> | undefined
}

/**
 * canUseTool → 渲染进程对话框 的异步 IPC 桥。
 *
 * 防悬挂三件套（spec: permission-approval AC-3/4/5）：
 * 1. 工具调用的 AbortSignal 触发 → 该请求 deny
 * 2. webContents 销毁 → 全部待定请求 deny
 * 3. respond 携带未知/已解决 id → 幂等忽略
 *
 * 未悬挂是硬性要求：未解决的 canUseTool Promise 会静默冻结 agent 回合。
 */
export class PermissionBridge {
  private pending = new Map<string, PendingEntry>()

  constructor(
    private readonly win: WebContentsLike,
    private readonly store: PermissionStore
  ) {
    this.win.once('destroyed', () => this.denyAll())
  }

  /** 注入 query() options.canUseTool */
  readonly handler: CanUseTool = async (toolName, input, options) => {
    // 优先匹配"总是允许"规则 —— 命中则直接放行，不弹窗
    if (this.store.isAllowed(toolName, input as Record<string, unknown>)) {
      return { behavior: 'allow' }
    }

    const id = randomUUID()
    const { signal, suggestions, blockedPath, decisionReason, title, displayName, description } =
      options

    return new Promise<PermissionResult>((resolve) => {
      const onAbort = (): void => {
        if (this.pending.delete(id)) {
          resolve({ behavior: 'deny', message: 'Permission request aborted' })
        }
      }
      signal?.addEventListener('abort', onAbort)

      this.pending.set(id, {
        resolve,
        cleanup: () => signal?.removeEventListener('abort', onAbort),
        toolName,
        input: input as Record<string, unknown>
      })

      if (this.win.isDestroyed()) {
        this.pending.delete(id)
        signal?.removeEventListener('abort', onAbort)
        resolve({ behavior: 'deny', message: 'Window destroyed' })
        return
      }

      this.win.send('permission:request', {
        id,
        toolName,
        input,
        suggestions,
        blockedPath,
        decisionReason,
        title,
        displayName,
        description
      })
    })
  }

  /** IPC permission:respond handler 调用；幂等（AC-5） */
  respond(id: string, decision: PermissionDecision): void {
    const entry = this.pending.get(id)
    if (!entry) return
    this.pending.delete(id)
    entry.cleanup()

    // 总是允许：写入主进程规则存储（跨会话持久化）
    if (
      decision.behavior === 'allow' &&
      (decision as { updatedPermissions?: unknown[] }).updatedPermissions !== undefined
    ) {
      void this.store.grant(entry.toolName, entry.input)
    }

    entry.resolve(this.toPermissionResult(decision))
  }

  /** 会话/应用销毁时调用：全部待定请求拒绝（AC-4） */
  denyAll(): void {
    for (const entry of this.pending.values()) {
      entry.cleanup()
      entry.resolve({ behavior: 'deny', message: 'Permission request cancelled' })
    }
    this.pending.clear()
  }

  private toPermissionResult(decision: PermissionDecision): PermissionResult {
    if (decision.behavior === 'allow') {
      return {
        behavior: 'allow',
        updatedInput: decision.updatedInput,
        updatedPermissions: decision.updatedPermissions
      }
    }
    return {
      behavior: 'deny',
      message: decision.message ?? 'Denied by user'
    }
  }
}
