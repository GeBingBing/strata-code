import { describe, expect, it, beforeEach } from 'vitest'
import { getPanels, registerPanel, usePanels } from './sidebarRegistry'
import { renderHook } from '@testing-library/react'

/** spec: sidebar-registry AC-1 —— 面板注册机制 */

function makePanel(id: string, order?: number) {
  const Icon = () => null
  Icon.displayName = `Icon-${id}`
  const Component = () => null
  Component.displayName = `Panel-${id}`
  return { id, title: id, icon: Icon, component: Component, order }
}

beforeEach(() => {
  // 清理通过 unregister 副作用无法保证；测试间 id 不复用即可
})

describe('sidebarRegistry', () => {
  it('registerPanel 注册后 getPanels 包含；返回的卸载函数移除', () => {
    const panel = makePanel('test-a')
    const unregister = registerPanel(panel)

    const panels = getPanels()
    expect(panels.some((p) => p.id === 'test-a')).toBe(true)

    unregister()
    expect(getPanels().some((p) => p.id === 'test-a')).toBe(false)
  })

  it('getPanels 按 order 升序排序', () => {
    const a = makePanel('late', 10)
    const b = makePanel('early', 1)
    const unA = registerPanel(a)
    const unB = registerPanel(b)

    const panels = getPanels()
    const early = panels.findIndex((p) => p.id === 'early')
    const late = panels.findIndex((p) => p.id === 'late')
    expect(early).toBeLessThan(late)

    unA()
    unB()
  })

  it('usePanels 响应 registerPanel 触发更新', () => {
    const { result, rerender } = renderHook(() => usePanels())
    const before = result.current.length

    const unregister = registerPanel(makePanel('hook-a'))
    rerender()

    expect(result.current.length).toBe(before + 1)
    expect(result.current.some((p) => p.id === 'hook-a')).toBe(true)

    unregister()
  })
})
