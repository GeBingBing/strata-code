import { describe, it } from 'vitest'
import { expect } from '@playwright/test'
import { launchApp } from './helpers'

/**
 * E2E（fake 模式）：记忆链路 —— 注入与蒸馏在主进程继续，但渲染层不再展示给用户
 * （spec: memory-injection / memory-distillation）
 */
describe('memory e2e (fake mode, hidden from UI)', () => {
  it('发送消息后渲染层不展示召回块或蒸馏徽标', async () => {
    const { app, page } = await launchApp()

    try {
      const input = page.getByTestId('composer-input')
      await input.waitFor({ state: 'visible', timeout: 15_000 })
      await input.fill('remember me')

      await page.getByTestId('send-button').click()

      // 等待回到空闲（证明 SDK 流程跑完了）
      await expect
        .poll(
          async () => (await page.getByTestId('status-bar').textContent()) ?? '',
          { timeout: 15_000 }
        )
        .toContain('空闲')

      // 渲染层不展示召回块
      await expect(page.locator('[data-testid="memory-recall"]')).toHaveCount(0)
      // 渲染层不展示蒸馏徽标
      await expect(page.locator('[data-testid="memory-distill"]')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })
})
