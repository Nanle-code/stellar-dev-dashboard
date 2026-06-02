/**
 * useInfiniteScroll — IntersectionObserver-based infinite scroll hook
 *
 * Attaches to a sentinel element at the bottom of a list. When the sentinel
 * enters the viewport the `onLoadMore` callback fires — debounced so rapid
 * layout shifts don't trigger duplicate requests.
 *
 * @param onLoadMore  - Async or sync function to call when more items are needed
 * @param hasMore     - Whether there are more items to load (stops observing when false)
 * @param loading     - Whether a load is currently in flight (prevents double-firing)
 * @param debounceMs  - Minimum ms between consecutive load calls (default: 300)
 * @param threshold   - IntersectionObserver threshold (default: 0.1)
 *
 * Returns a `ref` to attach to the sentinel element.
 *
 * Usage:
 *   const sentinelRef = useInfiniteScroll(loadMore, hasMore, loading)
 *   <div ref={sentinelRef} />
 */
import { useRef, useEffect, useCallback } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  hasMore: boolean,
  loading: boolean,
  debounceMs = 300,
  threshold = 0.1,
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const lastCallRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedLoad = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastCallRef.current
    if (elapsed >= debounceMs) {
      lastCallRef.current = now
      onLoadMore()
    } else {
      // Schedule for the remainder of the debounce window
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        lastCallRef.current = Date.now()
        onLoadMore()
      }, debounceMs - elapsed)
    }
  }, [onLoadMore, debounceMs])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          debouncedLoad()
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [debouncedLoad, hasMore, loading, threshold])

  return sentinelRef
}
