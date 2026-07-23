/**
 * useSwipeGesture – detects horizontal/vertical swipe on a touch element.
 * Used for the mobile drawer (swipe-left-to-close) and charts (swipe to pan).
 */
import { useEffect, useRef } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  /** Minimum distance (px) to register as a swipe. Default 50. */
  threshold?: number
  /** Maximum perpendicular drift allowed. Default 100. */
  restraint?: number
}

export function useSwipeGesture<T extends HTMLElement>(
  options: SwipeOptions,
) {
  const ref = useRef<T>(null)
  const touch = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const { threshold = 50, restraint = 100 } = options

    const onTouchStart = (e: TouchEvent) => {
      touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touch.current.x
      const dy = e.changedTouches[0].clientY - touch.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDx >= threshold && absDy <= restraint) {
        if (dx > 0) options.onSwipeRight?.()
        else options.onSwipeLeft?.()
      } else if (absDy >= threshold && absDx <= restraint) {
        if (dy > 0) options.onSwipeDown?.()
        else options.onSwipeUp?.()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [options])

  return ref
}
