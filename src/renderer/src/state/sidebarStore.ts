import { create } from 'zustand'

export type SidebarTab = string

interface SidebarState {
  /** 当前 sidebar 显示的内容 */
  tab: SidebarTab
  /** sidebar 是否完全折叠（活动栏仍可见） */
  collapsed: boolean
  setTab: (tab: SidebarTab) => void
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
}

/**
 * Sidebar 状态（活动栏 + 折叠）。
 * 默认显示文件树，符合 Cursor 默认 UX。
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  tab: 'files',
  collapsed: false,

  setTab: (tab) => set({ tab }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (collapsed) => set({ collapsed })
}))