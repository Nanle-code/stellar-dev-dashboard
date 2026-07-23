import React, { useEffect, useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import type { CopyableValueProps } from '../../types/components'

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  // execCommand is deprecated but kept as a final fallback for very old browsers.
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export default function CopyableValue({
  value,
  children,
  title = 'Copy to clipboard',
  textStyle,
  containerStyle,
  buttonStyle,
}: CopyableValueProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timeout = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!value) return
    try {
      await copyText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: 0,
        ...containerStyle,
      }}
    >
      <span style={{ display: 'inline-block', minWidth: 0, ...textStyle }}>
        {children ?? value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied' : title}
        aria-label={copied ? 'Copied to clipboard' : title}
        style={{
          background: 'none',
          border: 'none',
          color: copied ? 'var(--green)' : 'var(--text-muted)',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'var(--transition)',
          ...buttonStyle,
        }}
        onMouseEnter={(e) => {
          if (!copied) e.currentTarget.style.color = 'var(--cyan)'
        }}
        onMouseLeave={(e) => {
          if (!copied) e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  )
}
