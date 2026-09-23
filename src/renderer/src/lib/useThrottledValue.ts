import { useEffect, useRef, useState } from 'react'

/**
 * 高频更新下 markdown 重渲染节流（spec: chat-ui AC-10）。
 *
 * 关键约束：保证「最新值必达」(trailing edge) + 避免连续两次提交间隔太近。
 * 实现：setTimeout 节流（保留单测可控），但窗口缩短到 32ms (~30fps 流畅感)，
 * 且每次提交前比对 currentValue 避免不必要渲染。
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value)
  const lastCommitRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef(value)

  latestRef.current = value

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastCommitRef.current

    const commit = (): void => {
      lastCommitRef.current = Date.now()
      timerRef.current = null
      // 仅当与最新值不同时才提交，避免无意义 setState
      setThrottled((prev) => (Object.is(prev, latestRef.current) ? prev : latestRef.current))
    }

    if (elapsed >= intervalMs) {
      commit()
      return undefined
    }

    // 窗口中段：定时器到点提交最新值（value 再次变化时上一个定时器被 cleanup 取消）
    timerRef.current = setTimeout(commit, intervalMs - elapsed)
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, intervalMs])

  return throttled
}
