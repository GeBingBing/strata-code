import { describe, expect, it } from 'vitest'
import { launchApp } from './helpers'

/** E2E（fake 模式）：会话创建与侧栏展示（spec: session-history） */
describe('sessions e2e (fake mode)', () => {
  it('发消息后侧栏出现会话条目；可删除', async () => {
    const { app, page } = await launchApp()

    try {
      const input = page.getByTestId('composer-input')
      await input.waitFor({ state: 'visible', timeout: 15_000 })
      await input.fill('session one')
      await page.getByTestId('send-button').click()

      // 切到 sessions tab 看侧栏
      await page.getByTestId('activity-sessions').click()
      await page.getByTestId('session-sidebar').waitFor({ state: 'visible', timeout: 5_000 })

      // FakeAgent 固定 session id 'fake-session-0001' → onSessionStart upsert 索引
      await expect
        .poll(
          async () => await page.getByTestId('session-sidebar').textContent(),
          { timeout: 15_000 }
        )
        .toContain('session one')

      // 删除会话
      const deleteBtn = page.locator('.session-delete').first()
      await deleteBtn.click()
      await expect
        .poll(async () => await page.getByTestId('session-sidebar').textContent(), {
          timeout: 10_000
        })
        .not.toContain('session one')
    } finally {
      await app.close()
    }
  })
})
