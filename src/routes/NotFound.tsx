/**
 * NotFound — rendered when the URL does not match any route in the registry.
 *
 * Previously unknown paths silently fell back to Overview; exposing a real 404
 * keeps shared/bookmarked links honest (#959).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPath, getRouteById } from './routes';

export default function NotFound() {
  const navigate = useNavigate();
  const overview = getRouteById('overview');

  return (
    <section
      aria-labelledby="not-found-title"
      data-testid="not-found"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '48px 32px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '640px',
      }}
    >
      <div
        aria-hidden="true"
        style={{ fontSize: '40px', lineHeight: 1, color: 'var(--cyan)' }}
      >
        ⚠
      </div>
      <h1
        id="not-found-title"
        style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}
      >
        Page not found
      </h1>
      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        We couldn&apos;t find a dashboard view for this URL. It may have moved, or the link
        may be incorrect.
      </p>
      <button
        type="button"
        onClick={() => navigate(buildPath('overview'))}
        style={{
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--cyan-dim)',
          background: 'var(--cyan-glow)',
          color: 'var(--cyan)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        {overview ? `Go to ${overview.title}` : 'Go to Overview'}
      </button>
    </section>
  );
}
