/**
 * MobileOptimizationDemo - Showcase mobile-optimized features
 * Issue #140: Mobile optimization with touch gestures and responsive layouts
 */
import React, { useState } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { usePinchZoom } from '../../hooks/usePinchZoom'
import BottomSheet from '../mobile/BottomSheet'
import Card from '../dashboard/Card'

export default function MobileOptimizationDemo() {
  const { isMobile, isTablet, windowWidth } = useResponsive()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [swipeCount, setSwipeCount] = useState({ left: 0, right: 0 })

  // Swipe gesture demo
  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: () => setSwipeCount(c => ({ ...c, left: c.left + 1 })),
    onSwipeRight: () => setSwipeCount(c => ({ ...c, right: c.right + 1 })),
  })

  // Pinch zoom demo
  const { ref: zoomRef, scale, reset } = usePinchZoom<HTMLDivElement>({
    minScale: 0.5,
    maxScale: 3,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700 }}>
        Mobile Optimization Demo
      </h2>

      {/* Device Info */}
      <Card title="Device Detection" subtitle="Current viewport information">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Device Type:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {isMobile ? '📱 Mobile' : isTablet ? '💻 Tablet' : '🖥️ Desktop'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Viewport Width:</span>
            <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
              {windowWidth}px
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Touch Enabled:</span>
            <span style={{ color: 'var(--green)' }}>
              {'ontouchstart' in window ? '✓ Yes' : '✗ No'}
            </span>
          </div>
        </div>
      </Card>

      {/* Swipe Gesture Demo */}
      <Card title="Swipe Gestures" subtitle="Try swiping left/right on this card">
        <div
          ref={swipeRef}
          style={{
            padding: '48px 24px',
            background: 'var(--bg-elevated)',
            border: '2px dashed var(--border-bright)',
            borderRadius: 'var(--radius-lg)',
            margin: '16px',
            textAlign: 'center',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈 👉</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Swipe left or right on this area
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px' }}>
            <div>
              <div style={{ fontSize: '24px', color: 'var(--cyan)', fontWeight: 700 }}>
                {swipeCount.left}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LEFT</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', color: 'var(--amber)', fontWeight: 700 }}>
                {swipeCount.right}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RIGHT</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Pinch Zoom Demo */}
      <Card title="Pinch-to-Zoom" subtitle="Use two fingers to zoom on mobile">
        <div style={{ padding: '16px' }}>
          <div
            ref={zoomRef}
            style={{
              padding: '48px',
              background: 'var(--bg-elevated)',
              border: '2px dashed var(--border-bright)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Pinch to zoom (touch devices only)
            </div>
            <div
              style={{
                marginTop: '16px',
                fontSize: '28px',
                color: 'var(--cyan)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {scale.toFixed(2)}×
            </div>
          </div>
          {scale > 1.1 && (
            <button
              onClick={reset}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                background: 'var(--cyan)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Zoom
            </button>
          )}
        </div>
      </Card>

      {/* Bottom Sheet Demo */}
      <Card title="Bottom Sheet Modal" subtitle="Mobile-optimized modal pattern">
        <div style={{ padding: '16px' }}>
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            Open Bottom Sheet
          </button>
        </div>
      </Card>

      {/* Touch Target Demo */}
      <Card title="Touch Targets" subtitle="WCAG 2.1 AAA compliant (48×48px)">
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: '12px' }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              style={{
                minWidth: '48px',
                minHeight: '48px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '18px',
                cursor: 'pointer',
                transition: 'transform 100ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
              onTouchEnd={e => { e.currentTarget.style.transform = '' }}
            >
              {n}
            </button>
          ))}
        </div>
      </Card>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Mobile Bottom Sheet"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This is a mobile-optimized bottom sheet modal. On mobile devices, it slides up from the
            bottom. On desktop, it appears as a centered modal dialog.
          </p>
          <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Features:</h4>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.8 }}>
              <li>Swipe-down-to-dismiss gesture</li>
              <li>Backdrop blur effect</li>
              <li>Safe-area insets support</li>
              <li>Focus trap for accessibility</li>
              <li>Escape key support</li>
            </ul>
          </div>
          <button
            onClick={() => setSheetOpen(false)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--cyan)',
              color: 'var(--bg-base)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close Sheet
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
