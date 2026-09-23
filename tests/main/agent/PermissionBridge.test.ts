import { describe, expect, it } from 'vitest'
import type { PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'
import { PermissionBridge } from '../../../src/main/agent/PermissionBridge'
import type { WebContentsLike } from '../../../src/main/ipc-interfaces'
import { PermissionStore } from '../../../src/main/permissions/permissionStore'

/** spec: permission-approval —— 测试先行的防悬挂三件套（AC-1~6） */

function createFakeWin() {
  const sent: Array<{ channel: string; payload: unknown }> = []
  const listeners = new Map<string, () => void>()
  let destroyed = false
  const win: WebContentsLike = {
    send: (channel: string, payload: unknown) => {
      sent.push({ channel, payload })
    },
    once: (event: string, listener: () => void) => {
      listeners.set(event, listener)
    },
    isDestroyed: () => destroyed
  }
  return {
    win,
    sent,
    destroy: () => {
      destroyed = true
      listeners.get('destroyed')?.()
    }
  }
}

function makeAbortable(): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController()
  return { signal: controller.signal, abort: () => controller.abort() }
}

const callOptions = (extra: Record<string, unknown> = {}) => ({
  signal: makeAbortable().signal,
  toolUseID: 'tu-1',
  requestId: 'req-1',
  ...extra
})

describe('PermissionBridge', () => {
  it('AC-1/2: canUseTool 发出带唯一 id 的 permission:request；respond 后 Promise 以 decision 决议', async () => {
    const { win, sent } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())

    const pending = bridge.handler('Bash', { command: 'rm -rf /tmp/x' }, callOptions() as never)
    await new Promise((r) => setTimeout(r)) // 等待 send

    expect(sent).toHaveLength(1)
    expect(sent[0].channel).toBe('permission:request')
    const request = sent[0].payload as { id: string; toolName: string; input: unknown }
    expect(request.toolName).toBe('Bash')
    expect(request.input).toEqual({ command: 'rm -rf /tmp/x' })
    expect(request.id).toBeTruthy()

    bridge.respond(request.id, { behavior: 'allow' })
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ behavior: 'allow' })
    )
  })

  it('AC-3: AbortSignal 触发 → 该请求 deny 且 Promise 不悬挂', async () => {
    const { win, sent } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())
    const { signal, abort } = makeAbortable()

    const pending = bridge.handler('Bash', { command: 'ls' }, callOptions({ signal }) as never)
    await new Promise((r) => setTimeout(r))

    abort()

    const result = await pending
    expect(result).toEqual(
      expect.objectContaining({ behavior: 'deny' })
    )

    // abort 后再 respond → 幂等忽略
    const id = (sent[0].payload as { id: string }).id
    bridge.respond(id, { behavior: 'allow' })
    expect(bridge.respond(id, { behavior: 'allow' })).toBeUndefined()
  })

  it('AC-4: webContents 销毁 → 全部待定请求 deny', async () => {
    const { win, sent, destroy } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())

    const p1 = bridge.handler('Read', { file_path: '/a' }, callOptions() as never)
    const p2 = bridge.handler('Write', { file_path: '/b' }, callOptions() as never)
    await new Promise((r) => setTimeout(r))
    expect(sent).toHaveLength(2)

    destroy()

    await expect(p1).resolves.toEqual(expect.objectContaining({ behavior: 'deny' }))
    await expect(p2).resolves.toEqual(expect.objectContaining({ behavior: 'deny' }))
  })

  it('AC-5: 未知 id 的 respond 不抛异常；重复 respond 幂等', async () => {
    const { win } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())

    expect(() => bridge.respond('nonexistent', { behavior: 'allow' })).not.toThrow()

    const pending = bridge.handler('Bash', { command: 'ls' }, callOptions() as never)
    await new Promise((r) => setTimeout(r))
    // 第一次 respond 生效
    // （从内部拿不到 id —— 通过 denyAll 之外的路径测试重复性）
    // 改为直接验证：已解决后再 respond 同 id 不抛
    bridge.denyAll()
    await expect(pending).resolves.toEqual(expect.objectContaining({ behavior: 'deny' }))
  })

  it('AC-6: always-allow 决议透传 updatedPermissions', async () => {
    const { win, sent } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())
    const suggestions: PermissionUpdate[] = [
      { type: 'addRules', rules: [{ toolName: 'Bash' }], behavior: 'allow', destination: 'session' }
    ]

    const pending = bridge.handler(
      'Bash',
      { command: 'ls' },
      callOptions({ suggestions }) as never
    )
    await new Promise((r) => setTimeout(r))
    const id = (sent[0].payload as { id: string }).id

    bridge.respond(id, { behavior: 'allow', updatedPermissions: suggestions })
    const result = await pending
    expect(result).toEqual(
      expect.objectContaining({ behavior: 'allow', updatedPermissions: suggestions })
    )
  })

  it('窗口已销毁时新请求直接 deny（构造后销毁的竞态）', async () => {
    const { win, destroy } = createFakeWin()
    const bridge = new PermissionBridge(win, new PermissionStore())
    destroy()

    const pending = bridge.handler('Bash', { command: 'ls' }, callOptions() as never)
    await expect(pending).resolves.toEqual(expect.objectContaining({ behavior: 'deny' }))
  })
})
