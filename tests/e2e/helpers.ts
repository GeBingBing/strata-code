import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'node:path'

/**
 * 启动应用（fake 模式）：APP_AGENT_MODE=fake → AgentService 用 FakeAgent，
 * 零网络零子进程，全链路（main → preload → renderer → IPC）真实运行。
 */
export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    args: [resolve(__dirname, '../../out/main/index.js')],
    env: {
      ...process.env,
      APP_AGENT_MODE: 'fake',
      NODE_ENV: 'production'
    }
  })
  const page = await app.firstWindow()
  return { app, page }
}
