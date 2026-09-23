import { defineConfig } from 'vitest/config'

// E2E：Playwright _electron 启动打包产物 out/main/index.js。
// APP_AGENT_MODE=fake 时 AgentService 使用 createMockQuery（零网络、确定性脚本）。
export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['tests/e2e/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Electron 应用串行启动，避免并行 launch 竞争
    fileParallelism: false,
    // Electron 冷启动偶发抖动 —— 失败重试一次
    retry: 1
  }
})
