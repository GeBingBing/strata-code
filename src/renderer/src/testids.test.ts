import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * spec: test-infrastructure (AC-4/5)
 * 验证四个约定的 testid 前缀：
 *   - message-*    消息气泡
 *   - tool-card-*  工具调用卡片
 *   - permission-* 权限对话框与按钮
 *   - diff-*       diff 预览
 *
 * 策略：枚举每个敏感组件文件，断言其 data-testid 都落在该文件的合法前缀集合中。
 * 合法前缀集合是该文件的"主类别前缀 + 局部例外"（例如 streaming-cursor 是
 * MessageItem 的局部子元素，不属于 message-* 但被显式允许）。
 *
 * 该文件虽然在 src/renderer/src 下但无需 jsdom 环境（无 React/DOM 依赖）。
 */

const repoRoot = join(__dirname, '..', '..', '..')
const rendererRoot = join(repoRoot, 'src', 'renderer', 'src')

function collectTestIds(relative: string): string[] {
  const file = join(rendererRoot, relative)
  const src = readFileSync(file, 'utf8')
  return Array.from(src.matchAll(/data-testid="([^"]+)"/g), (m) => m[1]!)
}

/** 路径（相对 src/renderer/src） → 该文件允许的 testid 前缀/常量集合 */
const ALLOWED_PREFIXES_PER_FILE: Record<string, string[]> = {
  // message-* 类别
  'components/chat/MessageItem.tsx': ['message-', 'streaming-cursor', 'compact-boundary'],
  'components/chat/AssistantTurn.tsx': ['message-', 'assistant-turn'],
  'components/chat/ChatView.tsx': ['message-', 'qa-pair'],

  // tool-card-* 类别
  'components/tools/ToolCallCard.tsx': ['tool-card-'],

  // permission-* 类别
  'components/permissions/PermissionRequest.tsx': ['permission-'],
  'components/chat/PermissionModeSelector.tsx': ['permission-'],

  // diff-* 类别
  'components/diff/DiffPreview.tsx': ['diff-']
}

function matchesAny(id: string, allowed: string[]): boolean {
  return allowed.some((a) => id.startsWith(a))
}

describe('data-testid 前缀约定 (AC-4/5)', () => {
  for (const [rel, allowed] of Object.entries(ALLOWED_PREFIXES_PER_FILE)) {
    describe(rel, () => {
      it('所有 data-testid 都使用约定前缀或局部例外', () => {
        const ids = collectTestIds(rel)
        const offenders = ids.filter((id) => !matchesAny(id, allowed))
        expect(offenders).toEqual([])
      })
    })
  }

  it('四个约定前缀都至少出现一次', () => {
    const ids = Object.keys(ALLOWED_PREFIXES_PER_FILE).flatMap(collectTestIds)
    for (const prefix of ['message-', 'tool-card-', 'permission-', 'diff-']) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true)
    }
  })
})