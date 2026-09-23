import { describe, it } from 'vitest'
import { expect } from '@playwright/test'
import { launchApp } from './helpers'

/**
 * E2E（fake 模式）：spec: app-config AC-2/3 —— 工作目录显示与切换
 *
 * 不触发原生 dialog.showOpenDialog（Playwright 无法与系统对话框交互），
 * 而是通过 window.api.invoke('config:set', { cwd }) 模拟"用户选了目录"后
 * AgentService.setCwd 的效果，验证状态栏与 config:get 同步刷新。
 */

declare global {
  interface Window {
    api: {
      invoke: (channel: string, payload?: unknown) => Promise<unknown>
      on: (channel: string, cb: (payload: unknown) => void) => () => void
    }
  }
}

describe('config e2e (fake mode)', () => {
  it('启动后状态栏显示初始 cwd；config:set 后状态栏与 config:get 同步更新', async () => {
    const { app, page } = await launchApp()

    try {
      // 等状态栏可见 + 初始 cwd 已加载
      const statusCwd = page.getByTestId('status-cwd')
      await statusCwd.waitFor({ state: 'visible', timeout: 15_000 })
      const initialCwd = (await statusCwd.textContent())?.trim() ?? ''
      expect(initialCwd.length).toBeGreaterThan(0)

      // 通过 config:set 模拟"选择新目录"
      const newCwd = '/tmp/e2e-workspace-pick'
      await page.evaluate(async (cwd) => {
        await window.api.invoke('config:set', { cwd })
      }, newCwd)

      // 状态栏文本刷新（workspace:changed 事件 → ConfigStore.cwd）
      await expect
        .poll(async () => (await page.getByTestId('status-cwd').textContent())?.trim() ?? '', {
          timeout: 10_000
        })
        .toBe(newCwd)

      // config:get 读回新 cwd
      const fetched = (await page.evaluate(async () => {
        return (await window.api.invoke('config:get')) as { cwd: string }
      }))!
      expect(fetched.cwd).toBe(newCwd)
    } finally {
      await app.close()
    }
  })
})