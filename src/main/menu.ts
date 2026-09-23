import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'

/**
 * 应用原生菜单（native-menu spec）。
 * 菜单项通过 IPC 事件通知渲染层，由渲染层 store 处理具体业务。
 */
export function createMenuTemplate(win: BrowserWindow): MenuItemConstructorOptions[] {
  const send = (channel: string): (() => void) => {
    return () => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel)
      }
    }
  }

  return [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: send('menu:new-chat')
        },
        {
          label: 'Open Workspace',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: send('menu:open-workspace')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: send('menu:open-settings')
        },
        { type: 'separator' },
        { role: 'close', label: 'Close Window' },
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: send('menu:reload')
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About Claude SDK Agent',
          click: send('menu:about')
        }
      ]
    }
  ]
}
