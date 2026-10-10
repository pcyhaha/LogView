import React, { useCallback, useEffect, useRef, useState } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  getKey?: (item: T, index: number) => React.Key
  overscan?: number
  className?: string
}

// Fixed-row-height windowed list. Only renders the items in (and slightly
// around) the visible viewport, so huge result sets (e.g. 100k filter hits)
// don't create tens of thousands of DOM nodes. Items are absolutely positioned
// inside a spacer of total height; scrolling only re-computes the window.
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  getKey,
  overscan = 6,
  className
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(0)
  // rAF 合并滚动事件：每个 scroll 事件直接 setState 会连续触发重渲染
  const scrollTopRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setHeight(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = e.currentTarget.scrollTop
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setScrollTop(scrollTopRef.current)
      })
    }
  }, [])

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + height) / itemHeight) + overscan)

  const children: React.ReactNode[] = []
  for (let i = startIndex; i < endIndex; i++) {
    children.push(
      <div
        key={getKey ? getKey(items[i], i) : i}
        style={{ position: 'absolute', top: i * itemHeight, left: 0, right: 0, height: itemHeight }}
      >
        {renderItem(items[i], i)}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={onScroll}
      style={{ overflowY: 'auto', position: 'relative', height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>{children}</div>
    </div>
  )
}
