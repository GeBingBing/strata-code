import { describe, expect, it, vi } from 'vitest'
import { createMenuTemplate } from '../../src/main/menu'

/** spec: native-menu —— 应用菜单模板 */

describe('createMenuTemplate', () => {
  it('包含 File / Edit / View / Window / Help 菜单', () => {
    const send = vi.fn()
    const win = {
      isDestroyed: () => false,
      webContents: { send }
    } as never

    const template = createMenuTemplate(win)
    const labels = template.map((m) => m.label ?? m.role)

    expect(labels).toContain('File')
    expect(labels).toContain('Edit')
    expect(labels).toContain('View')
    expect(labels).toContain('window')
    expect(labels).toContain('help')
  })

  it('File → New Chat 点击发送 menu:new-chat', () => {
    const send = vi.fn()
    const win = {
      isDestroyed: () => false,
      webContents: { send }
    } as never

    const template = createMenuTemplate(win)
    const fileMenu = template.find((m) => m.label === 'File')
    const newChatItem = (fileMenu?.submenu as Array<{ label?: string; click?: () => void }> | undefined)?.find(
      (item) => item.label === 'New Chat'
    )

    expect(newChatItem).toBeDefined()
    newChatItem!.click!()
    expect(send).toHaveBeenCalledWith('menu:new-chat')
  })

  it('窗口已销毁时不发送事件', () => {
    const send = vi.fn()
    const win = {
      isDestroyed: () => true,
      webContents: { send }
    } as never

    const template = createMenuTemplate(win)
    const fileMenu = template.find((m) => m.label === 'File')
    const newChatItem = (fileMenu?.submenu as Array<{ label?: string; click?: () => void }> | undefined)?.find(
      (item) => item.label === 'New Chat'
    )

    newChatItem!.click!()
    expect(send).not.toHaveBeenCalled()
  })
})
