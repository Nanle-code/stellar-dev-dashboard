/**
 * usePinchZoom – tracks pinch-to-zoom gesture on a touch element.
 * Returns the current scale factor so charts can adjust their domain/zoom.
 */
import { useEffect, useRef, useState } from 'react'

interface PinchZoomOptions {
  minScale?: number
  maxScale?: number
  onScaleChange?: (scale: number) => void
}

export function usePinchZoom<T extends HTMLElement>(options: PinchZoomOptions = {}) {
  const { minScale = 0.5, maxScale = 4, onScaleChange } = options
  const ref = useRef<T>(null)
  const [scale, setScale] = useState(1)
  const initialDistance = useRef<number | null>(null)
  const initialScale = useRef(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const getDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches)
        initialScale.current = scale
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current !== null) {
        e.preventDefault()
        const newDistance = getDistance(e.touches)
        const ratio = newDistance / initialDistance.current
        const newScale = Math.min(maxScale, Math.max(minScale, initialScale.current * ratio))
        setScale(newScale)
        onScaleChange?.(newScale)
      }
    }

    const onTouchEnd = () => {
      if (initialDistance.current !== null) {
        initialDistance.current = null
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [scale, minScale, maxScale, onScaleChange])

  const reset = () => setScale(1)

  return { ref, scale, reset }
}
