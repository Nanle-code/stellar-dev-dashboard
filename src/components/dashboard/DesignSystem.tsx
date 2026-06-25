import React from 'react'
import { tokens, variantSystem } from '../../design-system'

const ROADMAP = [
  {
    step: 'Step 1',
    title: 'Design tokens',
    status: 'Implemented',
    details: ['Color tokens', 'Spacing tokens', 'Typography tokens'],
  },
  {
    step: 'Step 2',
    title: 'Variants',
    status: 'Implemented',
    details: ['Component variants', 'Variant system', 'Variant composition'],
  },
  {
    step: 'Step 3',
    title: 'Consistency',
    status: 'Planned',
    details: ['Automated checks', 'Linting rules', 'CI validation'],
  },
  {
    step: 'Step 4',
    title: 'Documentation',
    status: 'Drafted',
    details: ['Design system docs', 'Component docs', 'Usage guidelines'],
  },
  {
    step: 'Step 5',
    title: 'Migration',
    status: 'Planned',
    details: ['Migration guides', 'Breaking changes', 'Version tracking'],
  },
]

const STATUS_COLORS: Record<string, string> = {
  Implemented: '#2ecc71',
  Drafted: '#f39c12',
  Planned: '#7c6af7',
}

const S = {
  root: {
    display: 'grid',
    gap: '24px',
    padding: '0 0 24px 0',
  },
  hero: {
    padding: '28px',
    borderRadius: '24px',
    border: '1px solid var(--border-bright)',
    background:
      'radial-gradient(circle at top left, rgba(6, 182, 212, 0.18), transparent 34%), linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.96))',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.24)',
  },
  eyebrow: {
    fontSize: '10px',
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '10px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: 800,
    margin: 0,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '10px 0 0 0',
    maxWidth: '68ch',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    fontSize: '14px',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '18px',
  },
  badge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    borderRadius: '999px',
    border: `1px solid ${color}44`,
    background: `${color}1a`,
    color,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.12)',
  },
  sectionLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: '10px',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '17px',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-primary)',
  },
  sectionText: {
    margin: '8px 0 0 0',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    fontSize: '13px',
  },
  tokenChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tokenChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
  tokenSwatch: (value: string) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: value,
    border: '1px solid rgba(255,255,255,0.2)',
    flexShrink: 0,
  }),
  tokenCode: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  roadmap: {
    display: 'grid',
    gap: '12px',
  },
  roadmapCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
  },
  roadmapHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  roadmapStep: {
    fontSize: '11px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  roadmapTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '16px',
    fontWeight: 700,
    margin: '4px 0 0 0',
    color: 'var(--text-primary)',
  },
  roadmapList: {
    margin: '12px 0 0 0',
    paddingLeft: '18px',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    fontSize: '13px',
  },
  variantGrid: {
    display: 'grid',
    gap: '12px',
    marginTop: '14px',
  },
  variantCard: {
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  variantName: {
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  variantPurpose: {
    margin: '6px 0 0 0',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    fontSize: '13px',
  },
  variantList: {
    margin: '10px 0 0 0',
    paddingLeft: '18px',
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    fontSize: '12px',
  },
}

function colorPreviewEntries() {
  return [
    ['primary', tokens.colors.primary],
    ['secondary', tokens.colors.secondary],
    ['success', tokens.colors.success],
    ['warning', tokens.colors.warning],
    ['error', tokens.colors.error],
  ] as const
}

export default function DesignSystem() {
  const colorGroups = [
    ['Core colors', colorPreviewEntries()],
    ['Brand', Object.entries(tokens.colors.brand)],
    ['Semantic', Object.entries(tokens.colors.semantic)],
  ] as const

  const spacingEntries = Object.entries(tokens.spacing).filter(([key]) => key !== 'layout')
  const typographyEntries = [
    ['Display', tokens.typography.fontFamily.display],
    ['Body', tokens.typography.fontFamily.body],
    ['Mono', tokens.typography.fontFamily.mono],
  ] as const

  return (
    <div style={S.root}>
      <section style={S.hero}>
        <div style={S.eyebrow}>Design System</div>
        <h1 style={S.title}>Tokens, variants, and the migration path around them</h1>
        <p style={S.subtitle}>
          This area is the system of record for the dashboard&apos;s visual language. It keeps the current token set
          visible, explains how component variants should be composed, and documents the consistency and migration
          rules that keep the UI coherent as it evolves.
        </p>
        <div style={S.badgeRow}>
          <span style={S.badge('#2ecc71')}>Design tokens defined</span>
          <span style={S.badge('#7c6af7')}>Variant catalog ready</span>
          <span style={S.badge('#f39c12')}>Docs and migration guidance tracked</span>
        </div>
      </section>

      <div style={S.grid}>
        <section style={S.card}>
          <div style={S.sectionLabel}>Step 1</div>
          <h2 style={S.sectionTitle}>Design tokens</h2>
          <p style={S.sectionText}>
            Color, spacing, and typography tokens now live in a single source of truth, with legacy aliases preserved
            so the dashboard can migrate without breaking existing imports.
          </p>
          <div style={S.tokenGroup}>
            {colorGroups.map(([title, entries]) => (
              <div key={title}>
                <div style={S.sectionLabel}>{title}</div>
                <div style={S.tokenChips}>
                  {entries.map(([key, value]) => (
                    <div key={`${title}-${key}`} style={S.tokenChip}>
                      <span style={S.tokenSwatch(value)} />
                      <span>{key}</span>
                      <span style={S.tokenCode}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div style={S.sectionLabel}>Spacing scale</div>
              <div style={S.tokenChips}>
                {spacingEntries.map(([key, value]) => (
                  <div key={key} style={S.tokenChip}>
                    <span>{key}</span>
                    <span style={S.tokenCode}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={S.sectionLabel}>Typography</div>
              <div style={S.tokenChips}>
                {typographyEntries.map(([key, value]) => (
                  <div key={key} style={S.tokenChip}>
                    <span>{key}</span>
                    <span style={S.tokenCode}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={S.card}>
          <div style={S.sectionLabel}>Step 2</div>
          <h2 style={S.sectionTitle}>Variants</h2>
          <p style={S.sectionText}>
            Component variants should stay predictable. Each variant in the catalog is described by its purpose,
            composed token layers, and whether it is a finalized pattern or still guidance.
          </p>
          <div style={S.variantGrid}>
            {variantSystem.map((group) => (
              <div key={group.key} style={S.variantCard}>
                <div style={S.roadmapHeader}>
                  <div>
                    <p style={S.variantName}>{group.label}</p>
                    <p style={S.variantPurpose}>{group.purpose}</p>
                  </div>
                  <span style={S.badge('#7c6af7')}>{group.variants.length} variants</span>
                </div>
                <ul style={S.variantList}>
                  {group.variants.map((variant) => (
                    <li key={variant.key}>
                      <strong>{variant.label}</strong> {variant.description}
                      <div style={S.tokenCode}>{variant.composition.join(' + ')}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={S.card}>
        <div style={S.sectionLabel}>Roadmap</div>
        <h2 style={S.sectionTitle}>Consistency, documentation, and migration</h2>
        <p style={S.sectionText}>
          The next phases make the system safer to scale: automated checks keep styles consistent, documentation keeps
          usage discoverable, and migration notes keep breaking changes controlled.
        </p>
        <div style={S.roadmap}>
          {ROADMAP.map((item) => (
            <div key={item.step} style={S.roadmapCard}>
              <div style={S.roadmapHeader}>
                <div>
                  <div style={S.roadmapStep}>{item.step}</div>
                  <h3 style={S.roadmapTitle}>{item.title}</h3>
                </div>
                <span style={S.badge(STATUS_COLORS[item.status])}>{item.status}</span>
              </div>
              <ul style={S.roadmapList}>
                {item.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div style={S.grid}>
        <section style={S.card}>
          <div style={S.sectionLabel}>Step 3</div>
          <h2 style={S.sectionTitle}>Consistency</h2>
          <p style={S.sectionText}>
            Add automated checks that compare components against token usage, linting rules that catch drift, and CI
            validation that blocks regressions before they reach production.
          </p>
          <ul style={S.roadmapList}>
            <li>Automated checks against approved tokens and variants</li>
            <li>Linting rules for naming, composition, and token usage</li>
            <li>CI validation for diffs, screenshots, and visual regressions</li>
          </ul>
        </section>

        <section style={S.card}>
          <div style={S.sectionLabel}>Step 4</div>
          <h2 style={S.sectionTitle}>Documentation</h2>
          <p style={S.sectionText}>
            Keep design system docs close to the code so component docs and usage guidelines stay synchronized with the
            implementation.
          </p>
          <ul style={S.roadmapList}>
            <li>
              Design system docs in <code>docs/design-system.md</code>
            </li>
            <li>Component docs that show props, variants, and examples</li>
            <li>Usage guidelines that explain when to compose versus extend</li>
          </ul>
        </section>
      </div>

      <section style={S.card}>
        <div style={S.sectionLabel}>Step 5</div>
        <h2 style={S.sectionTitle}>Migration</h2>
        <p style={S.sectionText}>
          Migration should be deliberate: document breaking changes, provide upgrade notes, and keep version tracking
          visible so teams know what changed and why.
        </p>
        <div style={S.grid}>
          <div>
            <div style={S.sectionLabel}>Migration guides</div>
            <p style={S.sectionText}>Give teams a clear path for moving from old components to the new system.</p>
          </div>
          <div>
            <div style={S.sectionLabel}>Breaking changes</div>
            <p style={S.sectionText}>List removals, renamed tokens, and behavior changes before they land.</p>
          </div>
          <div>
            <div style={S.sectionLabel}>Version tracking</div>
            <p style={S.sectionText}>Record release notes and link token or component updates to a versioned history.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
