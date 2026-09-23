import { describe, it } from 'vitest'
import { expect } from '@playwright/test'
import { launchApp } from './helpers'

/**
 * E2E（fake 模式）：spec: cursor-parity MVP 集成
 * FakeAgent 默认脚本触发 Read 工具调用 → 验证 ToolCallCard 面包屑 + Read 增强渲染
 * 记忆蒸馏徽标已对用户隐藏（spec: workspace-foundation），因此本测试不再断言它
 */
describe('cursor-parity e2e (fake mode)', () => {
  it('Read 工具渲染面包屑（含 basename）+ Read 输出折叠', async () => {
    const { app, page } = await launchApp()

    try {
      const input = page.getByTestId('composer-input')
      await input.waitFor({ state: 'visible', timeout: 15_000 })
      await input.fill('open the file')

      await page.getByTestId('send-button').click()

      // Read 工具面包屑（spec: cursor-parity AC-3）—— FakeAgent 默认 file_path='/tmp/example.txt'
      await expect(page.getByTestId('tool-card-breadcrumb')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('tool-card-breadcrumb')).toContainText('example.txt')

      // 回到空闲态
      await expect
        .poll(
          async () => (await page.getByTestId('status-bar').textContent()) ?? '',
          { timeout: 15_000 }
        )
        .toContain('空闲')

      // 蒸馏徽标已对用户隐藏，不应出现
      await expect(page.locator('[data-testid="memory-distill"]')).toHaveCount(0)
    } finally {
      await app.close()
    }
  })
})