import { useState } from 'react'
import type { ExplanationContent } from '../../lib/explanation/content'

interface ExplainPopoverProps {
  content: ExplanationContent
  label?: string
}

/** Small keyboard-accessible, localizable explanation affordance. */
export default function ExplainPopover({ content, label = 'Explain this' }: ExplainPopoverProps) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 4 }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ border: 0, background: 'transparent', color: 'var(--cyan)', cursor: 'pointer', padding: '0 3px', fontSize: 11 }}
      >?
      </button>
      {open && (
        <span role="dialog" aria-label={content.title} style={{ position: 'absolute', zIndex: 20, top: '1.5em', left: 0, width: 280, padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', boxShadow: '0 8px 24px rgba(0,0,0,.3)', fontSize: 12, textAlign: 'left' }}>
          <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 5 }}>{content.title}</strong>
          <span style={{ display: 'block', lineHeight: 1.45 }}>{content.description}</span>
          <span style={{ display: 'block', marginTop: 7, color: 'var(--text-muted)' }}>Key fields: {content.keyFields.join(', ')}</span>
          <a href={content.docsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 7, color: 'var(--cyan)' }}>Stellar documentation</a>
        </span>
      )}
    </span>
  )
}

