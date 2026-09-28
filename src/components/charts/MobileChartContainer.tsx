/**
 * MobileChartContainer – wrapper for charts with touch gestures.
 * Adds pinch-to-zoom support and horizontal panning for wide charts on mobile.
 */
import React, { useState } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { usePinchZoom } from '../../hooks/usePinchZoom'

interface MobileChartContainerProps {
  children: React.ReactNode
  /** Allow horizontal panning for wide content. Default true on mobile. */
  allowPan?: boolean
  /** Allow pinch-to-zoom. Default true on mobile. */
  allowZoom?: boolean
  minHeight?: number
}

export default function MobileChartContainer({
  children,
  allowPan = true,
  allowZoom = true,
  minHeight = 200,
}: MobileChartContainerProps) {
  const { isMobile } = useResponsive()
  const [zoom, setZoom] = useState(1)
  const { ref: zoomRef, scale, reset } = usePinchZoom<HTMLDivElement>({
    minScale: 0.7,
    maxScale: 3,
    onScaleChange: (s) => setZoom(s),
  })

  if (!isMobile) {
    return <div style={{ minHeight }}>{children}</div>
  }

  return (
    <div
      ref={allowZoom ? zoomRef : null}
      style={{
        minHeight,
        overflow: allowPan ? 'auto' : 'hidden',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
      }}
    >
      <div
        style={{
          transform: allowZoom ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          transition: 'transform 0.1s ease-out',
        }}
      >
        {children}
      </div>
      {allowZoom && scale > 1.1 && (
        <button
          onClick={reset}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '6px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          Reset Zoom
        </button>
      )}
    </div>
  )
}
