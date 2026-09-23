import { create } from 'zustand'
import type { PermissionRequest } from '@shared/types'
import { invoke, subscribe } from '../ipc/client'

interface PermissionState {
  /** 待决的权限请求（理论上一次一个；map 容忍并发） */
  requests: PermissionRequest[]
  respond: (id: string, behavior: 'allow' | 'deny' | 'alwaysAllow') => Promise<void>
  connect: () => () => void
}

/**
 * 权限请求状态（permission-approval spec AC-7）。
 * alwaysAllow（AC-6）：透传 SDK suggestions 作为 updatedPermissions。
 */
export const usePermissionStore = create<PermissionState>((set, get) => ({
  requests: [],

  respond: async (id, behavior) => {
    const request = get().requests.find((r) => r.id === id)
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }))
    if (!request) return

    if (behavior === 'alwaysAllow') {
      await invoke('permission:respond', {
        id,
        decision: {
          behavior: 'allow',
          updatedPermissions: request.suggestions
        }
      })
      return
    }
    await invoke('permission:respond', {
      id,
      decision:
        behavior === 'allow'
          ? { behavior: 'allow' }
          : { behavior: 'deny', message: 'User denied this action' }
    })
  },

  connect: () =>
    subscribe('permission:request', (request) => {
      set((s) => ({ requests: [...s.requests, request] }))
    })
}))
