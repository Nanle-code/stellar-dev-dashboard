import React, { useState } from 'react'

const inputStyle = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function TemplateCustomizer({ template, onArgsChange }) {
  const [args, setArgs] = useState(() =>
    Object.fromEntries(template.constructor.map((p) => [p.name, '']))
  )

  const handleChange = (name, value) => {
    const next = { ...args, [name]: value }
    setArgs(next)
    onArgsChange?.(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Constructor Arguments
      </div>
      {template.constructor.map((param) => (
        <label key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {param.name}
            </span>
            <span style={{
              fontSize: '9px',
              padding: '1px 5px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--cyan)',
              fontFamily: 'var(--font-mono)',
            }}>
              {param.type}
            </span>
            {param.required && (
              <span style={{ fontSize: '10px', color: 'var(--red)' }}>*</span>
            )}
          </div>
          <input
            value={args[param.name]}
            onChange={(e) => handleChange(param.name, e.target.value)}
            placeholder={param.description}
            style={inputStyle}
          />
        </label>
      ))}
    </div>
  )
}
