import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useThrottledValue } from './useThrottledValue'

/** spec: chat-ui AC-10 —— 高频 delta 下 markdown 重渲染节流 */

describe('useThrottledValue', () => {
  it('节流窗口内不提交中间值；窗口到期提交最新值（丢弃过期渲染）', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(
        ({ v }: { v: string }) => useThrottledValue(v, 50),
        { initialProps: { v: '1' } }
      )
      expect(result.current).toBe('1')

      // delta 风暴：窗口内多次更新
      rerender({ v: '12' })
      rerender({ v: '123' })
      rerender({ v: '1234' })
      act(() => {
        vi.advanceTimersByTime(10)
      })
      // 窗口中段仍是旧值 —— 中间值 '12'/'123' 从未提交
      expect(result.current).toBe('1')

      act(() => {
        vi.advanceTimersByTime(45)
      })
      // 窗口结束：只提交该窗口内的最新值
      expect(result.current).toBe('1234')
    } finally {
      vi.useRealTimers()
    }
  })

  it('停止更新后最终值必达（不再丢尾）', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(
        ({ v }: { v: string }) => useThrottledValue(v, 50),
        { initialProps: { v: 'a' } }
      )
      rerender({ v: 'ab' })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current).toBe('ab')

      // 第二轮风暴
      rerender({ v: 'abc' })
      rerender({ v: 'abcd' })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current).toBe('abcd')
    } finally {
      vi.useRealTimers()
    }
  })
})