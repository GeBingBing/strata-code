import type { Command } from './commands'
import { registerCommands } from './commands'
import { useChatStore } from '../state/chatStore'
import { useSessionStore } from '../state/sessionStore'
import { useConfigStore } from '../state/configStore'
import { useEditorStore } from '../state/editorStore'
import { invoke } from '../ipc/client'

/**
 * 注册全部命令面板命令。
 * 由 App.tsx 在挂载时调用一次。
 */

export function registerAllCommands(): () => void {
  const commands: Command[] = [
    {
      id: 'app.openSettings',
      label: '打开设置…',
      shortcut: 'Cmd+,',
      category: 'App',
      action: () => window.dispatchEvent(new CustomEvent('app:open-settings'))
    },
    {
      id: 'chat.new',
      label: '新建对话',
      shortcut: 'Cmd+Shift+N',
      category: 'Chat',
      action: () => useSessionStore.getState().newChat()
    },
    {
      id: 'chat.stop',
      label: '停止当前回合',
      shortcut: 'Esc',
      category: 'Chat',
      action: () => useChatStore.getState().stop()
    },
    {
      id: 'chat.export.md',
      label: '导出会话为 Markdown',
      category: 'Export',
      action: () => useChatStore.getState().exportSession('markdown')
    },
    {
      id: 'chat.export.json',
      label: '导出会话为 JSON',
      category: 'Export',
      action: () => useChatStore.getState().exportSession('json')
    },
    {
      id: 'workspace.pick',
      label: '切换工作目录…',
      shortcut: 'Cmd+Shift+O',
      category: 'Workspace',
      action: () => useConfigStore.getState().pickWorkspace()
    },
    {
      id: 'permission.default',
      label: '权限模式 → 默认',
      category: 'Permission',
      action: () => useConfigStore.getState().setPermissionMode('default')
    },
    {
      id: 'permission.acceptEdits',
      label: '权限模式 → 自动接受编辑',
      category: 'Permission',
      action: () => useConfigStore.getState().setPermissionMode('acceptEdits')
    },
    {
      id: 'permission.plan',
      label: '权限模式 → 计划模式',
      category: 'Permission',
      action: () => useConfigStore.getState().setPermissionMode('plan')
    },
    {
      id: 'permission.bypass',
      label: '权限模式 → 绕过权限',
      category: 'Permission',
      action: () => useConfigStore.getState().setPermissionMode('bypassPermissions')
    },
    {
      id: 'theme.dark',
      label: '主题 → 深色',
      category: 'Editor',
      action: () => useConfigStore.getState().setTheme('vs-dark')
    },
    {
      id: 'theme.light',
      label: '主题 → 浅色',
      category: 'Editor',
      action: () => useConfigStore.getState().setTheme('vs')
    },
    {
      id: 'theme.hc',
      label: '主题 → 高对比',
      category: 'Editor',
      action: () => useConfigStore.getState().setTheme('hc-black')
    },
    {
      id: 'editor.wordwrap.toggle',
      label: '编辑器 → 切换词换行',
      category: 'Editor',
      action: () => useConfigStore.getState().toggleWordWrap()
    },
    {
      id: 'editor.minimap.toggle',
      label: '编辑器 → 切换 minimap',
      category: 'Editor',
      action: () => useConfigStore.getState().toggleMinimap()
    },
    {
      id: 'file.quickOpen',
      label: '打开文件…',
      shortcut: 'Cmd+P',
      category: 'File',
      action: () => window.dispatchEvent(new CustomEvent('app:quick-open'))
    },
    {
      id: 'editor.save',
      label: '保存当前文件',
      shortcut: 'Cmd+S',
      category: 'Editor',
      action: async () => {
        const path = useEditorStore.getState().activePath
        if (!path) return
        const tab = useEditorStore.getState().tabs.find((t) => t.path === path)
        // 二进制/超大文件无编辑器 → no-op（AC-2）
        if (!tab || tab.isBinary || tab.isTooLarge) return
        try {
          await invoke('file:write', { path: tab.path, content: tab.content })
          useEditorStore.getState().markSaved(path)
        } catch {
          // 失败保留 dirty（AC-3）
        }
      }
    }
  ]

  return registerCommands(commands)
}