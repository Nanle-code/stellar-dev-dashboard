import React, { useEffect, useMemo } from 'react';
import { generateCspNonce, buildCspHeader } from '../utils/security';

export interface SecurityHeadersProps {
  nonce?: string;
}

export function SecurityHeaders({ nonce }: SecurityHeadersProps): JSX.Element {
  const resolvedNonce = useMemo(() => nonce ?? generateCspNonce(), [nonce]);
  const cspValue = useMemo(() => buildCspHeader(resolvedNonce), [resolvedNonce]);

  useEffect(() => {
    const metaTags = [
      { httpEquiv: 'Content-Security-Policy', content: cspValue },
      { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
      { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'permissions-policy', content: 'camera=(), microphone=(), geolocation=()' },
    ];

    const inserted = metaTags.map(({ httpEquiv, name, content }) => {
      const existing = httpEquiv
        ? document.querySelector(`meta[http-equiv="${httpEquiv}"]`)
        : document.querySelector(`meta[name="${name}"]`);

      if (existing) {
        existing.setAttribute('content', content);
        return null;
      }

      const el = document.createElement('meta');
      if (httpEquiv) el.setAttribute('http-equiv', httpEquiv);
      if (name) el.setAttribute('name', name);
      el.setAttribute('content', content);
      document.head.appendChild(el);
      return el;
    });

    return () => {
      inserted.forEach((el) => el && el.parentNode?.removeChild(el));
    };
  }, [cspValue]);

  return null;
}

export default SecurityHeaders;
