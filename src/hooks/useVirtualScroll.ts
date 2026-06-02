/**
 * useVirtualScroll — lightweight virtual list windowing hook
 *
 * Renders only the items visible in the viewport (plus an overscan buffer)
 * so that lists with thousands of rows don't freeze the browser.
 *
 * Assumptions:
 *  - All items have the same fixed row height (itemHeight)
 *  - The scrollable container has a known height (containerHeight)
 *
 * Usage:
 *   const { virtualItems, totalHeight, offsetTop } =
 *     useVirtualScroll({ items, itemHeight: 64, containerHeight: 600 })
 *
 *   <div style={{ height: containerHeight, overflowY: 'auto' }} ref={containerRef}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       <div style={{ position: 'absolute', top: offsetTop, width: '100%' }}>
 *         {virtualItems.map(({ item, index }) => <Row key={index} item={item} />)}
 *       </div>
 *     </div>
 *   </div>
 */
import { useState, useRef, useCallback, useEffect } from 'react'

interface UseVirtualScrollOptions<T> {
  items: T[]
  /** Height of each row in pixels (fixed-height rows) */
  itemHeight: number
  /** Height of the scrollable container in pixels */
  containerHeight: number
  /** Extra rows to render above and below the visible window */
  overscan?: number
}

interface VirtualScrollResult<T> {
  /** Attach this ref to the scrollable container element */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Only these items should be rendered */
  virtualItems: Array<{ item: T; index: number }>
  /** Total pixel height of the virtualised list (use for the inner spacer) */
  totalHeight: number
  /** Pixel offset from the top of the inner spacer to the first rendered row */
  offsetTop: number
}

export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: UseVirtualScrollOptions<T>): VirtualScrollResult<T> {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const totalHeight = items.length * itemHeight

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2)

  const virtualItems = []
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({ item: items[i], index: i })
  }

  const offsetTop = startIndex * itemHeight

  return { containerRef, virtualItems, totalHeight, offsetTop }
}

/** Threshold above which virtual scrolling is automatically enabled */
export const VIRTUAL_SCROLL_THRESHOLD = 200
