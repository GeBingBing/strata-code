import { describe, expect, it } from 'vitest'
import { diffFromToolInput } from './diffFromToolInput'

/** spec: diff-approval —— 工具入参 → unified diff */

describe('diffFromToolInput', () => {
  it('Edit: old_string → new_string 产生 +/- 行', () => {
    const result = diffFromToolInput('Edit', {
      file_path: '/tmp/a.ts',
      old_string: 'const a = 1',
      new_string: 'const a = 2'
    })
    expect(result?.filePath).toBe('/tmp/a.ts')
    expect(result?.patch).toContain('-const a = 1')
    expect(result?.patch).toContain('+const a = 2')
  })

  it('Write: 空文件 → 新内容', () => {
    const result = diffFromToolInput('Write', {
      file_path: '/tmp/new.ts',
      content: 'export const x = 1'
    })
    expect(result?.patch).toContain('+export const x = 1')
  })

  it('MultiEdit: 多个编辑拼接', () => {
    const result = diffFromToolInput('MultiEdit', {
      file_path: '/tmp/b.ts',
      edits: [
        { old_string: 'a', new_string: 'b' },
        { old_string: 'c', new_string: 'd' }
      ]
    })
    expect(result?.patch).toContain('+b')
    expect(result?.patch).toContain('+d')
  })

  it('非编辑工具 → null', () => {
    expect(diffFromToolInput('Read', { file_path: '/x' })).toBeNull()
    expect(diffFromToolInput('Bash', { command: 'ls' })).toBeNull()
    expect(diffFromToolInput('Edit', undefined)).toBeNull()
  })
})
