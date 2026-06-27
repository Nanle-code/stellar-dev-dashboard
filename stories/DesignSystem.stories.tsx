/**
 * D-028 — Design System documentation story.
 *
 * Surfaces the design token catalog (colors, spacing, typography, radii, motion)
 * and the variant system directly in Storybook so developers never need to leave
 * the component browser to look up a token or understand how a variant is composed.
 */
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { tokens } from '../src/design-system/tokens';
import { variantSystem } from '../src/design-system/variants';

const meta: Meta = {
  title: 'Design System/Tokens',
  parameters: {
    docs: {
      description: {
        component:
          'Source-of-truth token catalog. All colors, spacing, typography, radii, and motion values used across the dashboard.',
      },
    },
  },
};
export default meta;

// ─── Shared primitives ────────────────────────────────────────────────────────

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    style={{
      fontFamily: 'var(--font-display)',
      fontSize: '18px',
      fontWeight: 700,
      color: 'var(--text-primary)',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border)',
    }}
  >
    {children}
  </h2>
);

const TokenLabel = ({ name, value }: { name: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: '12px',
    }}
  >
    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>{name}</code>
    <span style={{ color: 'var(--text-muted)' }}>{value}</span>
  </div>
);

// ─── Colors ───────────────────────────────────────────────────────────────────

export const Colors: StoryObj = {
  name: 'Colors',
  render: () => {
    const swatches: { label: string; token: string; value: string }[] = [
      { label: 'brand.primary', token: 'tokens.colors.brand.primary', value: tokens.colors.brand.primary },
      { label: 'brand.secondary', token: 'tokens.colors.brand.secondary', value: tokens.colors.brand.secondary },
      { label: 'semantic.info', token: 'tokens.colors.semantic.info', value: tokens.colors.semantic.info },
      { label: 'semantic.success', token: 'tokens.colors.semantic.success', value: tokens.colors.semantic.success },
      { label: 'semantic.warning', token: 'tokens.colors.semantic.warning', value: tokens.colors.semantic.warning },
      { label: 'semantic.danger', token: 'tokens.colors.semantic.danger', value: tokens.colors.semantic.danger },
      { label: 'surface.background', token: 'tokens.colors.surface.background', value: tokens.colors.surface.background },
      { label: 'surface.card', token: 'tokens.colors.surface.card', value: tokens.colors.surface.card },
      { label: 'surface.elevated', token: 'tokens.colors.surface.elevated', value: tokens.colors.surface.elevated },
      { label: 'text.primary', token: 'tokens.colors.text.primary', value: tokens.colors.text.primary },
      { label: 'text.secondary', token: 'tokens.colors.text.secondary', value: tokens.colors.text.secondary },
      { label: 'text.muted', token: 'tokens.colors.text.muted', value: tokens.colors.text.muted },
      { label: 'border.subtle', token: 'tokens.colors.border.subtle', value: tokens.colors.border.subtle },
      { label: 'border.default', token: 'tokens.colors.border.default', value: tokens.colors.border.default },
      { label: 'border.strong', token: 'tokens.colors.border.strong', value: tokens.colors.border.strong },
    ];

    return (
      <div style={{ maxWidth: 800, fontFamily: 'var(--font-sans)' }}>
        <SectionTitle>Color Tokens</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
          Import from{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
            src/design-system/colors
          </code>{' '}
          or access via CSS custom properties (
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>var(--cyan)</code>,{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>var(--bg-card)</code>,
          etc.) in inline styles.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          {swatches.map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '60px',
                  background: value,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              />
              <div style={{ padding: '8px 10px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '2px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <SectionTitle>CSS Custom Properties (Runtime)</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
          These are the CSS variables set in{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>src/styles/globals.css</code>{' '}
          and switched by the{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>data-theme</code> attribute.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            ['--bg-base', 'Page background'],
            ['--bg-card', 'Card surface'],
            ['--bg-elevated', 'Elevated surface (inputs, dropdowns)'],
            ['--border', 'Default border'],
            ['--cyan', 'Primary accent (interactive elements)'],
            ['--cyan-dim', 'Muted cyan for glow borders'],
            ['--green', 'Success state'],
            ['--red', 'Destructive / error state'],
            ['--amber', 'Warning / testnet badge'],
            ['--text-primary', 'High-emphasis text'],
            ['--text-secondary', 'Medium-emphasis text'],
            ['--text-muted', 'Labels, captions, meta'],
            ['--font-sans', 'Body font (Inter)'],
            ['--font-display', 'Heading font (Syne)'],
            ['--font-mono', 'Code/address font (Space Mono)'],
          ].map(([token, desc]) => (
            <div
              key={token}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
            >
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', display: 'block', marginBottom: '2px' }}>
                {token}
              </code>
              <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: { layout: 'padded' },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing: StoryObj = {
  name: 'Spacing',
  render: () => {
    const scale = Object.entries(tokens.spacing).filter(([, v]) => typeof v === 'string') as [string, string][];
    return (
      <div style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
        <SectionTitle>Spacing Scale</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
          Import from{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>src/design-system/spacing</code>.
          Use the scale keys (xs → xxl) in component styles. Prefer tokens over arbitrary pixel values.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scale.map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--cyan)',
                  width: '40px',
                  flexShrink: 0,
                }}
              >
                {key}
              </code>
              <div
                style={{
                  height: '16px',
                  background: 'var(--cyan)',
                  opacity: 0.6,
                  borderRadius: '2px',
                  width: value,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px' }}>
          <SectionTitle>Layout Spacing</SectionTitle>
          {Object.entries(tokens.spacing.layout).map(([key, value]) => (
            <TokenLabel key={key} name={`spacing.layout.${key}`} value={value} />
          ))}
        </div>
      </div>
    );
  },
  parameters: { layout: 'padded' },
};

// ─── Typography ───────────────────────────────────────────────────────────────

export const Typography: StoryObj = {
  name: 'Typography',
  render: () => (
    <div style={{ maxWidth: 680, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Type Scale</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
        Import from{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>src/design-system/typography</code>.
      </p>

      {/* Font families */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Font Families
        </div>
        {Object.entries(tokens.typography.fontFamily).map(([key, value]) => (
          <div key={key} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }}>
                typography.fontFamily.{key}
              </code>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{value}</span>
            </div>
            <div
              style={{
                fontSize: '22px',
                fontFamily: value,
                color: 'var(--text-primary)',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              Stellar Dev Dashboard
            </div>
          </div>
        ))}
      </div>

      {/* Font sizes */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Font Sizes
        </div>
        {Object.entries(tokens.typography.fontSize).map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '16px',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', width: '32px', flexShrink: 0 }}>{key}</code>
            <span style={{ fontSize: value, color: 'var(--text-primary)', lineHeight: 1 }}>Aa</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Font weights */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Font Weights
        </div>
        {Object.entries(tokens.typography.fontWeight).map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', width: '80px', flexShrink: 0 }}>{key}</code>
            <span style={{ fontWeight: value, fontSize: '14px', color: 'var(--text-primary)' }}>
              The quick brown fox
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

// ─── Radii ────────────────────────────────────────────────────────────────────

export const Radii: StoryObj = {
  name: 'Border Radii',
  render: () => (
    <div style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Border Radii</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
        Use via{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>tokens.radii.*</code> or
        CSS variables{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>var(--radius-sm)</code>,{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>var(--radius-md)</code>,
        etc.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {Object.entries(tokens.radii).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--cyan)',
                borderRadius: value,
              }}
            />
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }}>{key}</code>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

// ─── Motion ───────────────────────────────────────────────────────────────────

export const Motion: StoryObj = {
  name: 'Motion',
  render: () => (
    <div style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Motion Tokens</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
        Use these values for consistent animation durations and easing. Respect{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>prefers-reduced-motion</code> —
        disable or simplify transitions when this media query is active.
      </p>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Durations</div>
        {Object.entries(tokens.motion.duration).map(([key, value]) => (
          <TokenLabel key={key} name={`motion.duration.${key}`} value={value} />
        ))}
      </div>

      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Easing</div>
        {Object.entries(tokens.motion.easing).map(([key, value]) => (
          <TokenLabel key={key} name={`motion.easing.${key}`} value={value} />
        ))}
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Live Demo</div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(tokens.motion.duration).map(([key, value]) => {
          const [hovered, setHovered] = React.useState(false);
          return (
            <button
              key={key}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                padding: '10px 20px',
                background: hovered ? 'var(--cyan)' : 'var(--bg-card)',
                color: hovered ? 'var(--bg-base)' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                transition: `all ${value} ${tokens.motion.easing.standard}`,
              }}
            >
              {key} ({value})
            </button>
          );
        })}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

// ─── Variants ─────────────────────────────────────────────────────────────────

export const Variants: StoryObj = {
  name: 'Component Variants',
  render: () => {
    const statusColors: Record<string, string> = {
      ready: 'var(--green)',
      guidance: 'var(--cyan)',
      planned: 'var(--amber)',
    };

    return (
      <div style={{ maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
        <SectionTitle>Variant System</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.6 }}>
          Defined in{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>src/design-system/variants.ts</code>.
          Variants are composed from token references so they stay in sync when tokens change.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {(['ready', 'guidance', 'planned'] as const).map((s) => (
            <span
              key={s}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: `${statusColors[s]}22`,
                color: statusColors[s],
                border: `1px solid ${statusColors[s]}44`,
                textTransform: 'uppercase',
              }}
            >
              {s}
            </span>
          ))}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>= implementation status</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {variantSystem.map((group) => (
            <div key={group.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>{group.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{group.purpose}</div>
              </div>
              <div>
                {group.variants.map((variant, i) => (
                  <div
                    key={variant.key}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      borderBottom: i < group.variants.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{variant.label}</span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            background: `${statusColors[variant.status]}22`,
                            color: statusColors[variant.status],
                            textTransform: 'uppercase',
                          }}
                        >
                          {variant.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{variant.description}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {variant.composition.map((token) => (
                          <code
                            key={token}
                            style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--cyan)',
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                            }}
                          >
                            {token}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: { layout: 'padded' },
};

// ─── Accessibility guidelines ─────────────────────────────────────────────────

export const AccessibilityGuidelines: StoryObj = {
  name: 'Accessibility Guidelines',
  render: () => (
    <div style={{ maxWidth: 680, fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
      <SectionTitle>Accessibility Guidelines</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
        The dashboard targets WCAG 2.1 AA. These guidelines apply to all new components.
        Full validation requires manual testing with assistive technologies and expert review.
      </p>

      {[
        {
          title: 'Keyboard Navigation',
          items: [
            'All interactive elements are reachable by Tab.',
            'Enter / Space activate buttons and links.',
            'Escape closes modals, sheets, and dropdowns.',
            'Arrow keys navigate lists, menus, and grids.',
            'Ctrl+K opens the command palette from anywhere.',
          ],
        },
        {
          title: 'Screen Reader Support',
          items: [
            'Meaningful aria-label on icon-only buttons.',
            'aria-live="polite" for async state changes (loading, errors, success).',
            'Landmark regions: <main>, <nav>, <aside>, <header>.',
            'Role="status" on notification and banner components.',
            'aria-expanded on accordion and dropdown triggers.',
          ],
        },
        {
          title: 'Color & Contrast',
          items: [
            'Text on --bg-base / --bg-card passes 4.5:1 minimum contrast.',
            'Never rely on color alone to convey state — pair with icons or text.',
            'High-contrast mode via AccessibilitySettings.',
            'Dark and light themes both validated.',
          ],
        },
        {
          title: 'Motion',
          items: [
            'Respect prefers-reduced-motion — skip or simplify transitions.',
            'Animations use tokens from tokens.motion.duration.',
            'No looping animations that cannot be paused.',
          ],
        },
        {
          title: 'Focus Management',
          items: [
            'Focus moves into modals on open; returns to trigger on close.',
            'Focus trap inside BottomSheet and modal overlays.',
            'Visible focus ring using var(--cyan) outline.',
          ],
        },
      ].map(({ title, items }) => (
        <div key={title} style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--cyan)',
                flexShrink: 0,
              }}
            />
            {title}
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map((item) => (
              <li key={item} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};
