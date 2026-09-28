/**
 * BottomSheet – mobile-first modal that slides up from the bottom.
 * On desktop it renders as a centered modal overlay.
 * Supports swipe-down-to-close on touch devices.
 */
import React, { useEffect, useRef, useCallback } from 'react'
import { useResponsive } from '../../hooks/useResponsive'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** Max height as a CSS value. Default '85vh'. */
  maxHeight?: string
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}: BottomSheetProps) {
  const { isMobile } = useResponsive()
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<number | null>(null)
  const dragCurrent = useRef(0)

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Swipe-down-to-close
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY
    dragCurrent.current = 0
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStart.current === null) return
    const dy = e.touches[0].clientY - dragStart.current
    dragCurrent.current = dy
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (dragCurrent.current > 100) {
      onClose()
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragStart.current = null
    dragCurrent.current = 0
  }, [onClose])

  if (!open) return null

  if (!isMobile) {
    // Desktop: centered modal
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={e => e.stopPropagation()}
        >
          {title && <SheetHeader title={title} onClose={onClose} />}
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>{children}</div>
        </div>
      </div>
    )
  }

  // Mobile: bottom sheet
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%',
          maxHeight,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: 'var(--border-bright)',
            }}
          />
        </div>

        {title && <SheetHeader title={title} onClose={onClose} />}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 20px' }}>{children}</div>
      </div>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '20px',
          cursor: 'pointer',
          minWidth: '48px',
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
        }}
      >
        ✕
      </button>
    </div>
  )
}
