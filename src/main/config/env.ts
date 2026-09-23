import { promises as fs } from 'node:fs'

/**
 * .env 文件解析（spec: agent-env-config）。
 * 无第三方依赖 —— 规则：KEY=VALUE（以第一个 = 分割）、# 注释、
 * 引号包裹的值剥离引号、无效行忽略。
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  // 去除 BOM
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 剥离成对的单/双引号
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * 依序加载多个 .env 文件，后加载的覆盖先前的；缺失文件跳过（AC-2）。
 */
export async function loadEnvOverrides(paths: string[]): Promise<Record<string, string>> {
  const overrides: Record<string, string> = {}
  for (const path of paths) {
    try {
      const content = await fs.readFile(path, 'utf-8')
      Object.assign(overrides, parseEnvFile(content))
    } catch {
      // 文件不存在 —— 跳过
    }
  }
  return overrides
}
