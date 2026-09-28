/**
 * CopyableValue (#839)
 *
 * A copy-to-clipboard affordance that gates secret-adjacent values (secret
 * keys, transaction envelopes, recovery phrases, tokens) behind an explicit
 * confirmation step. Non-sensitive values keep the original one-click behaviour.
 */

import React, { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Check, Copy, ShieldAlert } from 'lucide-react'
import type { CopyableValueProps } from '../../types/components'
import { classifySensitiveValue, confirmationPromptFor } from '../../lib/sensitiveValue'

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
  sensitive,
  sensitiveLabel,
  onCopy,
}: CopyableValueProps) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const verdict = useMemo(
    () => classifySensitiveValue(value, Boolean(sensitive)),
    [value, sensitive]
  )
  const needsConfirmation = verdict.sensitive
  const prompt = sensitiveLabel || confirmationPromptFor(verdict)

  useEffect(() => {
    if (!copied) return undefined
    const timeout = window.setTimeout(() => setCopied(false), 1200)
    return () => window.clearTimeout(timeout)
  }, [copied])

  // Reset the confirmation latch whenever the underlying value changes.
  useEffect(() => {
    setConfirming(false)
  }, [value])

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!value) return

    if (needsConfirmation && !confirming) {
      setConfirming(true)
      return
    }

    try {
      await copyText(value)
      setConfirming(false)
      setCopied(true)
      onCopy?.(value)
    } catch {
      setCopied(false)
    }
  }

  const buttonTitle = copied
    ? 'Copied'
    : confirming
      ? `Confirm copy — ${prompt}`
      : needsConfirmation
        ? `Copy sensitive value — ${prompt}`
        : title

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
        title={buttonTitle}
        aria-label={copied ? 'Copied to clipboard' : confirming ? 'Confirm sensitive copy' : title}
        aria-live="polite"
        data-confirming={confirming || undefined}
        data-sensitive={needsConfirmation || undefined}
        style={{
          background: confirming ? 'rgba(245, 158, 11, 0.12)' : 'none',
          border: 'none',
          color: copied ? 'var(--green)' : confirming ? '#f59e0b' : 'var(--text-muted)',
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
          if (!copied && !confirming) e.currentTarget.style.color = 'var(--cyan)'
        }}
        onMouseLeave={(e) => {
          if (!copied && !confirming) e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        {copied ? <Check size={14} /> : confirming ? <ShieldAlert size={14} /> : <Copy size={14} />}
      </button>
    </span>
  )
}
