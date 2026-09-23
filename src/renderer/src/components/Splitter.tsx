import { useEffect, useRef, useState } from 'react'

interface Props {
  /** 比例变化回调 */
  onChange?: (ratio: number) => void
  /** 方向：horizontal（左右）或 vertical（上下） */
  direction?: 'horizontal' | 'vertical'
}

/**
 * 可拖拽分隔条 —— 拖动调整两侧区域的比例。
 * 比例持久化到 localStorage，跨会话保留。
 */
export function Splitter({ onChange, direction = 'horizontal' }: Props): React.JSX.Element {
  const storageKey = `splitter-ratio-${direction}`
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent): void => {
      const container = containerRef.current?.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const ratio =
        direction === 'horizontal'
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height
      const clamped = Math.max(0.15, Math.min(0.85, ratio))
      onChange?.(clamped)
      try {
        localStorage.setItem(storageKey, String(clamped))
      } catch {
        // ignore
      }
    }
    const onUp = (): void => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, direction, onChange, storageKey])

  return (
    <div
      ref={containerRef}
      className={`splitter splitter-${direction} ${dragging ? 'dragging' : ''}`}
      data-testid="splitter"
      onMouseDown={() => setDragging(true)}
      title="拖动调整比例"
    >
      {direction === 'horizontal' ? <span className="splitter-grip" /> : <span className="splitter-grip vertical" />}
    </div>
  )
}