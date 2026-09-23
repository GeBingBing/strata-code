import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnvOverrides, parseEnvFile } from '../../../src/main/config/env'

/** spec: agent-env-config AC-1~3 */

const dirs: string[] = []
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

describe('parseEnvFile', () => {
  it('AC-1: 基本 KEY=VALUE', () => {
    expect(parseEnvFile('ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic\nANTHROPIC_MODEL=MiniMax-M2')).toEqual({
      ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
      ANTHROPIC_MODEL: 'MiniMax-M2'
    })
  })

  it('AC-3: 跳过注释与空行；剥离引号；trim 空白', () => {
    const content = [
      '# MiniMax Anthropic 兼容端点',
      '',
      '  ANTHROPIC_AUTH_TOKEN = "sk-abc123"  ',
      "ANTHROPIC_MODEL='MiniMax-M2'",
      '# 另一段注释'
    ].join('\n')
    expect(parseEnvFile(content)).toEqual({
      ANTHROPIC_AUTH_TOKEN: 'sk-abc123',
      ANTHROPIC_MODEL: 'MiniMax-M2'
    })
  })

  it('AC-3: 值包含 = 号（以第一个 = 分割）', () => {
    expect(parseEnvFile('TOKEN=a=b=c')).toEqual({ TOKEN: 'a=b=c' })
  })

  it('空内容 → 空对象', () => {
    expect(parseEnvFile('')).toEqual({})
  })

  it('无 = 的行被忽略', () => {
    expect(parseEnvFile('INVALID_LINE\nX=1')).toEqual({ X: '1' })
  })
})

describe('loadEnvOverrides', () => {
  it('AC-2: 文件不存在 → {}（不抛）', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'env-test-'))
    dirs.push(dir)
    expect(await loadEnvOverrides([join(dir, 'nope.env')])).toEqual({})
  })

  it('多路径：后加载的覆盖先前的', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'env-test-'))
    dirs.push(dir)
    await writeFile(join(dir, 'a.env'), 'K=from-a\nONLY_A=1\n', 'utf-8')
    await writeFile(join(dir, 'b.env'), 'K=from-b\n', 'utf-8')

    const result = await loadEnvOverrides([join(dir, 'a.env'), join(dir, 'b.env')])
    expect(result).toEqual({ K: 'from-b', ONLY_A: '1' })
  })
})
