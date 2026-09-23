import { describe, it } from 'vitest'
import { expect } from '@playwright/test'
import { launchApp } from './helpers'

/** E2E（fake 模式）：发送 → 流式 → 工具卡片 → result（spec: agent-service/chat-ui 集成） */
describe('chat e2e (fake mode)', () => {
  it('发送消息后收到流式回复、工具卡片与空闲状态', async () => {
    const { app, page } = await launchApp()

    try {
      const input = page.getByTestId('composer-input')
      await input.waitFor({ state: 'visible', timeout: 15_000 })
      await input.fill('hello e2e')

      await page.getByTestId('send-button').click()

      // 流式回复（FakeAgent 回显）
      await expect(page.getByTestId('message-assistant')).toContainText('Echo: hello e2e', {
        timeout: 15_000
      })

      // 工具卡片（FakeAgent 模拟 Read 调用）
      await expect(page.getByTestId('tool-card-success')).toBeVisible({ timeout: 10_000 })

      // 回到空闲态
      await expect
        .poll(
          async () => (await page.getByTestId('status-bar').textContent()) ?? '',
          { timeout: 15_000 }
        )
        .toContain('空闲')
    } finally {
      await app.close()
    }
  })
})
