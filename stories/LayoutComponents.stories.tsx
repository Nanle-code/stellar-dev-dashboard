/**
 * D-028 — Layout component stories (Sidebar, MobileHeader, SearchBar).
 *
 * Full layout components depend on the Zustand store and router context.
 * Stories use isolated replicas that faithfully represent all documented
 * UI states — see docs/components.md for the authoritative prop reference.
 */
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Search, Bell, X, ChevronRight, LayoutDashboard, ArrowLeftRight, Code2, BarChart3, Droplets, Wallet, Settings, Beaker } from 'lucide-react';

const meta: Meta = {
  title: 'Layout/Navigation',
  parameters: {
    docs: {
      description: {
        component:
          'Navigation and layout shell components. Real components live at `src/components/layout/`. These stories use isolated replicas to avoid full app context.',
      },
    },
  },
};
export default meta;

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'contracts', label: 'Contracts', icon: Code2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'dex', label: 'DEX Explorer', icon: Droplets },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'testnet', label: 'Testnet Tools', icon: Beaker },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const SidebarPreview = ({
  activeItem = 'overview',
  network = 'testnet',
}: {
  activeItem?: string;
  network?: string;
}) => {
  const [active, setActive] = useState(activeItem);
  const NETWORK_COLORS: Record<string, string> = {
    mainnet: 'var(--green)',
    testnet: 'var(--amber)',
    futurenet: 'var(--cyan)',
  };

  return (
    <div
      style={{
        width: '220px',
        height: '600px',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '0 0 0 0',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            background: 'var(--cyan)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--bg-base)',
            fontFamily: 'var(--font-display)',
          }}
        >
          S
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1 }}>
            Stellar Dev
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '3px',
              padding: '1px 6px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${NETWORK_COLORS[network] || 'var(--border)'}`,
              borderRadius: '999px',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'capitalize' as const,
              color: NETWORK_COLORS[network] || 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: NETWORK_COLORS[network] || 'var(--text-muted)',
              }}
            />
            {network}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            aria-current={active === id ? 'page' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 16px',
              background: active === id ? 'var(--cyan-glow, rgba(0,229,255,0.06))' : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${active === id ? 'var(--cyan)' : 'transparent'}`,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: active === id ? 600 : 400,
              color: active === id ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 120ms ease',
            }}
          >
            <Icon
              size={15}
              style={{ color: active === id ? 'var(--cyan)' : 'var(--text-muted)', flexShrink: 0 }}
            />
            {label}
          </button>
        ))}
      </nav>

      {/* Account badge */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--cyan)',
          }}
        >
          G
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            GABC…XYZ
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Connected</div>
        </div>
      </div>
    </div>
  );
};

export const SidebarDefault: StoryObj = {
  name: 'Sidebar — Testnet',
  render: () => <SidebarPreview network="testnet" />,
  parameters: {
    docs: {
      description: {
        story:
          'Desktop sidebar with testnet badge. Active item highlighted with a left border and background tint. Real component: `src/components/layout/Sidebar.tsx`.',
      },
    },
  },
};

export const SidebarMainnet: StoryObj = {
  name: 'Sidebar — Mainnet',
  render: () => <SidebarPreview network="mainnet" activeItem="transactions" />,
};

export const SidebarFuturenet: StoryObj = {
  name: 'Sidebar — Futurenet',
  render: () => <SidebarPreview network="futurenet" activeItem="contracts" />,
};

// ─── MobileHeader ─────────────────────────────────────────────────────────────

const MobileHeaderPreview = ({
  menuOpen = false,
  network = 'testnet',
}: {
  menuOpen?: boolean;
  network?: string;
}) => {
  const [open, setOpen] = useState(menuOpen);
  const NETWORK_COLORS: Record<string, string> = {
    mainnet: 'var(--green)',
    testnet: 'var(--amber)',
    futurenet: 'var(--cyan)',
  };

  return (
    <div style={{ width: '100%' }}>
      <header
        style={{
          height: '52px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        {/* Hamburger */}
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {open ? (
            <X size={20} style={{ color: 'var(--text-primary)' }} />
          ) : (
            <>
              <span style={{ width: '18px', height: '2px', background: 'var(--text-primary)', borderRadius: '1px' }} />
              <span style={{ width: '18px', height: '2px', background: 'var(--text-primary)', borderRadius: '1px' }} />
              <span style={{ width: '18px', height: '2px', background: 'var(--text-primary)', borderRadius: '1px' }} />
            </>
          )}
        </button>

        {/* Logo */}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        >
          Stellar Dev
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Network badge */}
        <span
          style={{
            padding: '3px 8px',
            background: 'var(--bg-elevated)',
            border: `1px solid ${NETWORK_COLORS[network] || 'var(--border)'}`,
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'capitalize' as const,
            color: NETWORK_COLORS[network] || 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: NETWORK_COLORS[network] || 'var(--text-muted)',
            }}
          />
          {network}
        </span>

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          style={{
            width: '36px',
            height: '36px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={18} />
        </button>
      </header>

      {open && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 0',
          }}
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <Icon size={15} style={{ color: 'var(--text-muted)' }} />
              {label}
              <ChevronRight size={12} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const MobileHeaderDefault: StoryObj = {
  name: 'MobileHeader — Closed',
  render: () => <MobileHeaderPreview />,
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: {
      description: {
        story:
          'Fixed top bar with hamburger, logo, network badge, and notification bell. Real component: `src/components/layout/MobileHeader.tsx`.',
      },
    },
  },
};

export const MobileHeaderMenuOpen: StoryObj = {
  name: 'MobileHeader — Menu Open',
  render: () => <MobileHeaderPreview menuOpen />,
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: { description: { story: 'Mobile navigation drawer expanded.' } },
  },
};

// ─── SearchBar ────────────────────────────────────────────────────────────────

const SearchBarPreview = ({
  placeholder = 'Search accounts, transactions, contracts…',
  hasResults = false,
}: {
  placeholder?: string;
  hasResults?: boolean;
}) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const MOCK_RESULTS = [
    { type: 'Account', value: 'GABC...XYZ', detail: 'Public Key' },
    { type: 'Transaction', value: 'a1b2c3...', detail: 'Hash' },
    { type: 'Contract', value: 'CDEF...', detail: 'Soroban Contract' },
  ];

  const showDropdown = (focused && query.length > 0) || (hasResults && focused);

  return (
    <div style={{ maxWidth: '480px', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--cyan)' : 'var(--border)'}`,
          borderRadius: '8px',
          transition: 'border-color 120ms ease',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          role="combobox"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <kbd
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '2px 5px',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {MOCK_RESULTS.map((r, i) => (
            <div
              key={r.value}
              role="option"
              aria-selected={i === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderBottom: i < MOCK_RESULTS.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                background: i === 0 ? 'var(--cyan-glow, rgba(0,229,255,0.06))' : 'transparent',
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--cyan)',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {r.type}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.value}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{r.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SearchBarDefault: StoryObj = {
  name: 'SearchBar — Default',
  render: () => <SearchBarPreview />,
  parameters: {
    docs: {
      description: {
        story:
          'Global search bar. Gains a cyan focus ring when active. Dropdown shows results when query is non-empty. Real component: `src/components/layout/SearchBar.tsx`.',
      },
    },
  },
};

export const SearchBarWithResults: StoryObj = {
  name: 'SearchBar — With Results',
  render: () => {
    const [focused, setFocused] = React.useState(true);
    return (
      <div style={{ maxWidth: '480px', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--cyan)',
            borderRadius: '8px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            defaultValue="GABC"
            placeholder="Search…"
            aria-label="Global search"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)' }}
          />
        </div>
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {[
            { type: 'Account', value: 'GABC...XYZ', detail: 'Public Key' },
            { type: 'Transaction', value: 'a1b2c3...', detail: 'Hash' },
          ].map((r, i) => (
            <div
              key={r.value}
              role="option"
              aria-selected={i === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
                background: i === 0 ? 'rgba(0,229,255,0.06)' : 'transparent',
              }}
            >
              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', color: 'var(--cyan)', textTransform: 'uppercase' as const }}>
                {r.type}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{r.value}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.detail}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const SearchBarMobile: StoryObj = {
  name: 'SearchBar — Mobile',
  render: () => <SearchBarPreview />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};
