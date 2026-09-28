/**
 * D-028 — Migration guide story.
 *
 * Documents breaking changes, deprecation paths, and migration instructions
 * for each major version transition. This lives in Storybook so it is
 * co-located with the component catalog — no context-switching required.
 */
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Design System/Migration',
  parameters: {
    docs: {
      description: {
        component:
          'Migration guides and breaking change log for the Stellar Dev Dashboard component library.',
      },
    },
  },
};
export default meta;

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

const Chip = ({
  label,
  color,
}: {
  label: string;
  color: 'red' | 'amber' | 'green' | 'cyan';
}) => {
  const c = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)', cyan: 'var(--cyan)' }[color];
  return (
    <span
      style={{
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        background: `${c}22`,
        color: c,
        border: `1px solid ${c}44`,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
};

const CodeBlock = ({ code }: { code: string }) => (
  <pre
    style={{
      margin: '8px 0',
      padding: '12px 14px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      overflowX: 'auto',
      lineHeight: 1.7,
    }}
  >
    {code}
  </pre>
);

// ─── Version History ──────────────────────────────────────────────────────────

export const VersionHistory: StoryObj = {
  name: 'Version History',
  render: () => {
    const versions = [
      {
        version: '0.1.0',
        date: 'Jun 2025',
        summary: 'Initial release — dashboard shell, layout system, core components.',
        changes: [
          { type: 'new' as const, description: 'Dashboard shell: Sidebar, MobileHeader, MobileSidebar, DashboardGrid' },
          { type: 'new' as const, description: 'Core components: Card, StatCard, CopyableValue, ThemeToggle' },
          { type: 'new' as const, description: 'Chart suite: NetworkMetricsChart, BalanceHistoryChart, AccountActivityChart' },
          { type: 'new' as const, description: 'Accessibility: AccessibilitySettings, ScreenReaderAnnouncer, KeyboardNavigation' },
          { type: 'new' as const, description: 'Network: NetworkIndicator, OfflineBanner, RetryButton' },
          { type: 'new' as const, description: 'Assets: AssetCard, AssetDiscovery' },
          { type: 'new' as const, description: 'Forms: ValidatedInput (D-027)' },
          { type: 'new' as const, description: 'Design system: tokens, colors, spacing, typography, variants' },
          { type: 'new' as const, description: 'Storybook 8.5 with a11y, viewport addons and dark/light theme toolbar' },
        ],
      },
    ];

    const typeChip = (t: 'new' | 'break' | 'fix' | 'dep') => {
      const map = { new: ['green', 'New'], break: ['red', 'Breaking'], fix: ['cyan', 'Fix'], dep: ['amber', 'Deprecated'] } as const;
      return <Chip label={map[t][1]} color={map[t][0]} />;
    };

    return (
      <div style={{ maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
        <SectionTitle>Version History</SectionTitle>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
          Full changelog is also available at{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>docs/api/CHANGELOG.md</code>.
        </p>

        {versions.map((v) => (
          <div
            key={v.version}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'var(--cyan)',
                }}
              >
                v{v.version}
              </code>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{v.date}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{v.summary}</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {v.changes.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '7px 16px',
                    borderBottom: i < v.changes.length - 1 ? '1px solid var(--border)' : 'none',
                    fontSize: '12px',
                  }}
                >
                  {typeChip(c.type)}
                  <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
  parameters: { layout: 'padded' },
};

// ─── Breaking Changes ─────────────────────────────────────────────────────────

export const BreakingChanges: StoryObj = {
  name: 'Breaking Changes',
  render: () => (
    <div style={{ maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Breaking Changes</SectionTitle>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
        This section documents breaking changes that require code changes in consuming code.
        Follow the migration steps below each entry before upgrading.
      </p>

      {/* Placeholder for future breaking changes — shown as "no breaking changes yet" */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          No breaking changes in v0.1.0
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          This is the initial release. Future breaking changes will be documented here.
        </div>
      </div>

      {/* Template for future breaking changes */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          opacity: 0.5,
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Chip label="Breaking" color="red" />
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
            Example: Renamed prop (template for v0.2.0)
          </span>
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginLeft: 'auto',
            }}
          >
            v0.2.0 · Card
          </code>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            The <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>glow</code> prop
            on Card will be renamed to{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>highlighted</code>.
          </div>
          <CodeBlock
            code={`// v0.1.x (old)
<Card glow={true} title="…">…</Card>

// v0.2.0+ (new)
<Card highlighted title="…">…</Card>`}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Run{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
              npx codemod stellar-card-glow-to-highlighted
            </code>{' '}
            to automate the rename.
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};

// ─── Migration Guides ─────────────────────────────────────────────────────────

export const MigrationGuides: StoryObj = {
  name: 'Migration Guides',
  render: () => (
    <div style={{ maxWidth: 720, fontFamily: 'var(--font-sans)' }}>
      <SectionTitle>Migration Guides</SectionTitle>

      {[
        {
          title: 'JavaScript → TypeScript Components',
          status: 'In Progress',
          statusColor: 'amber' as const,
          description:
            'The codebase is migrating from .jsx to .tsx. New components must be TypeScript. Existing .jsx components are being converted incrementally.',
          steps: [
            'Rename the file from .jsx to .tsx.',
            'Add prop types using interfaces from src/types/components.ts where they exist.',
            'Enable strict type checking: tsconfig.json already has allowJs: true — no config change needed.',
            'Fix type errors surfaced by tsc --noEmit.',
            'Update the import in any .stories.tsx file if the extension changes.',
          ],
          code: `// src/types/components.ts — add your interface here
export interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

// src/components/dashboard/MyComponent.tsx
import type { MyComponentProps } from '../../types/components';

export default function MyComponent({ title, onAction }: MyComponentProps) {
  // …
}`,
        },
        {
          title: 'Inline Styles → CSS Custom Properties',
          status: 'Ongoing',
          statusColor: 'cyan' as const,
          description:
            'Components should use CSS custom properties (var(--token)) instead of hard-coded hex values. This ensures dark/light theme switching works correctly.',
          steps: [
            'Replace hard-coded colors with the closest CSS variable from src/styles/globals.css.',
            'Reference the token catalog (Design System / Tokens story) for the full list.',
            'Test both themes using the Theme toolbar in Storybook.',
            'Do not remove legacy token aliases until all call sites are migrated.',
          ],
          code: `// ❌ Before — hard-coded
<div style={{ color: '#f8fafc', background: '#0f172a' }}>

// ✅ After — theme-aware
<div style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}>`,
        },
        {
          title: 'Adopting the Variant System',
          status: 'Available',
          statusColor: 'green' as const,
          description:
            'New component variants should be defined in src/design-system/variants.ts, not as ad-hoc inline style objects.',
          steps: [
            'Check variants.ts — does a matching variant already exist?',
            'If yes, read its composition array and apply the referenced tokens.',
            'If no, add a new VariantDefinition to the appropriate group (or create a new group).',
            'Document the variant with a status of "planned" until it is implemented, then update to "ready".',
            'Add a Storybook story to Design System / Component Variants.',
          ],
          code: `// src/design-system/variants.ts — adding a new variant
{
  key: 'ghost',
  label: 'Ghost',
  description: 'Transparent background, border only. For tertiary actions.',
  composition: ['border.default', 'text.primary', 'radii.sm'],
  status: 'planned',
}`,
        },
      ].map(({ title, status, statusColor, description, steps, code }) => (
        <div
          key={title}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', flex: 1 }}>
              {title}
            </span>
            <Chip label={status} color={statusColor} />
          </div>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
              {description}
            </p>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              Steps
            </div>
            <ol
              style={{
                margin: '0 0 14px',
                paddingLeft: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {steps.map((step) => (
                <li key={step} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {step}
                </li>
              ))}
            </ol>
            <CodeBlock code={code} />
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: { layout: 'padded' },
};
