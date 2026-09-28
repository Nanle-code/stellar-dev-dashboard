import React from 'react'
import Card from '../dashboard/Card'

export default function LivePreview({ colors, typography, spacing }) {
  const borderColor = colors.primary + '33'

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Preview
      </div>
      <Card
        title="Theme Preview"
        subtitle={`${spacing.baseUnit}px base · ${typography.fontScale.toFixed(1)}x scale`}
        style={{
          background: colors.surface,
          borderColor: borderColor,
          color: colors.text,
          fontFamily: typography.fontFamily,
          fontSize: `${14 * typography.fontScale}px`,
        }}
      >
        <div style={{ padding: `calc(${spacing.baseUnit}px * 2)` }}>
          <p style={{
            color: colors.text,
            opacity: 0.85,
            fontSize: 'inherit',
            lineHeight: 1.6,
            marginBottom: `${spacing.baseUnit * 2}px`,
          }}>
            Sample body text rendered with the selected theme colors and typography.
          </p>

          <div style={{
            background: colors.background,
            border: `1px solid ${borderColor}`,
            borderRadius: `${Math.max(4, spacing.baseUnit)}px`,
            padding: `${spacing.baseUnit * 1.5}px`,
            marginBottom: `${spacing.baseUnit * 2}px`,
          }}>
            <code style={{
              fontFamily: "'Space Mono', monospace",
              color: colors.primary,
              fontSize: `${12 * typography.fontScale}px`,
            }}>
              const theme = {'{'} colors: {'{'}&quot;{colors.background}&quot; ... {'}'}{'}'}
            </code>
          </div>

          <button style={{
            background: colors.primary,
            color: colors.background,
            border: 'none',
            borderRadius: `${Math.max(4, spacing.baseUnit / 2)}px`,
            padding: `${spacing.baseUnit}px ${spacing.baseUnit * 2}px`,
            fontFamily: typography.fontFamily,
            fontSize: `${13 * typography.fontScale}px`,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 150ms ease',
          }}>
            Action Button
          </button>
        </div>
      </Card>
    </div>
  )
}
