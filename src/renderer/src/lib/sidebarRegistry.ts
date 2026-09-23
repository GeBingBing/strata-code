import { useSyncExternalStore } from 'react'

export interface SidebarPanel {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType
  order?: number
}

let snapshot: SidebarPanel[] = []
const listeners = new Set<() => void>()

function notify(): void {
  snapshot = [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const l of listeners) l()
}

const raw: SidebarPanel[] = []

export function registerPanel(panel: SidebarPanel): () => void {
  raw.push(panel)
  notify()
  return () => {
    const idx = raw.findIndex((p) => p.id === panel.id)
    if (idx >= 0) raw.splice(idx, 1)
    notify()
  }
}

export function getPanels(): SidebarPanel[] {
  return snapshot
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getServerSnapshot(): SidebarPanel[] {
  return []
}

export function usePanels(): SidebarPanel[] {
  return useSyncExternalStore(subscribe, getPanels, getServerSnapshot)
}
