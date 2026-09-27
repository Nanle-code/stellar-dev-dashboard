import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import CopyableValue from '../dashboard/CopyableValue';
import {
  NETWORKS,
  updateCustomNetworkConfig,
  switchToCustomProfile,
  loadCustomNetworkProfiles,
} from '../../lib/stellar';
import { getActiveProfile } from '../../lib/userPreferences';
import { preloadTab } from '../../hooks/usePreload';
import { getNavGroups, isRouteVisible, type AppRoute } from '../../routes/routes';
import { useAdaptiveComponents } from '../../hooks/useAdaptiveComponents';
import { useExpertiseTracking } from '../../hooks/useExpertiseTracking';
import { useSidebarArrowNav } from '../../hooks/useSidebarArrowNav';
import ExpertiseBadge from '../expertise/ExpertiseBadge';
import ExpertiseProgressPanel from '../expertise/ExpertiseProgressPanel';

const SESSION_API_KEY = 'stellar_custom_api_key';

type SidebarNavItem =
  | { type: 'header'; label: string }
  | { type: 'link'; route: AppRoute };

export interface SidebarProps {
  isMobile?: boolean;
}

export interface CustomProfile {
  id: string;
  name: string;
  horizonUrl: string;
  sorobanUrl?: string;
  passphrase: string;
}

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const navigate = useNavigate();
  const {
    activeTab,
    network,
    setNetwork,
    connectedAddress,
    theme,
    toggleTheme,
    isMobileMenuOpen,
    setMobileMenuOpen,
  } = useStore();

  const { getAdaptation, sidebarAdaptation, isNovice, isExpert } = useAdaptiveComponents();
  const { trackFeatureInteraction } = useExpertiseTracking({ enabled: true });
  const [showExpertisePanel, setShowExpertisePanel] = useState(false);

  const expertiseLevel = isExpert ? 'expert' : isNovice ? 'novice' : 'intermediate';
  const navItems = React.useMemo<SidebarNavItem[]>(() => {
    const items: SidebarNavItem[] = [];
    for (const group of getNavGroups()) {
      items.push({ type: 'header', label: group.label });
      for (const route of group.routes) {
        if (isRouteVisible(route, { expertiseLevel })) {
          items.push({ type: 'link', route });
        }
      }
    }
    return items;
  }, [expertiseLevel]);

  const [customProfiles, setCustomProfiles] = useState<CustomProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [customHeaderName, setCustomHeaderName] = useState<string>('');
  const [customHeaderValue, setCustomHeaderValue] = useState<string>('');
  const asideRef = useRef<HTMLElement>(null);

  useSidebarArrowNav(asideRef, !isMobile || isMobileMenuOpen);

  useEffect(() => {
    if (network === 'custom') {
      loadCustomNetworkProfiles().then((profiles: CustomProfile[]) => {
        setCustomProfiles(profiles);
        getActiveProfile().then((profile: CustomProfile | null) => {
          if (profile) {
            setActiveProfileId(profile.id);
            updateCustomNetworkConfig({
              horizonUrl: profile.horizonUrl,
              sorobanUrl: profile.sorobanUrl,
              passphrase: profile.passphrase,
            });
          }
        });
      });
    }
  }, [network]);

  const handleNavClick = (tabId: string) => {
    navigate(`/${tabId}`);
    setMobileMenuOpen(false);
  };

  const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    if (id && typeof switchToCustomProfile === 'function') {
      switchToCustomProfile(id);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_API_KEY);
    if (saved) {
      updateCustomNetworkConfig({ customHeaders: { Authorization: `Bearer ${saved}` } });
    }
  }, []);

  const sidebarStyles: React.CSSProperties = {
    width: isMobile ? 'var(--sidebar-width-mobile)' : 'var(--sidebar-width)',
    maxWidth: isMobile ? 'calc(100vw - 24px)' : 'none',
    minHeight: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    transform: isMobile
      ? isMobileMenuOpen
        ? 'translateX(0)'
        : 'translateX(-100%)'
      : 'translateX(0)',
    transition: 'transform var(--transition)',
    boxShadow: isMobile && isMobileMenuOpen ? '4px 0 20px rgba(0, 0, 0, 0.3)' : 'none',
  };

  const customInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const updateCustomHeader = (name: string, value: string) => {
    setCustomHeaderName(name);
    setCustomHeaderValue(value);

    const updatedHeaders: Record<string, string> =
      name.trim() && value.trim() ? { [name.trim()]: value.trim() } : {};

    updateCustomNetworkConfig({
      headers: updatedHeaders,
    });
  };

  return (
    <>
      {isMobile && (
        <div
          className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside ref={asideRef} style={sidebarStyles} aria-label="Main navigation" id="sidebar">
        {isMobile && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1001 }}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="touch-target"
              aria-label="Close navigation menu"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--cyan)',
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            role="img"
            aria-label="Stellar Dev Dashboard"
          >
            <span aria-hidden="true" style={{ fontSize: '22px' }}>
              ✦
            </span>
            STELLAR
            <br />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '13px' }}>
              DEV DASHBOARD
            </span>
          </div>
        </div>

        {/* Network selector */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <label
            htmlFor="network-select"
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginBottom: '10px',
              letterSpacing: '1px',
              display: 'block',
            }}
          >
            NETWORK
          </label>
          <select
            id="network-select"
            value={network}
            onChange={(e) => setNetwork(e.target.value as any)}
            aria-label="Select Stellar network"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--cyan-dim)',
              color: 'var(--cyan)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              outline: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              appearance: 'none',
            }}
          >
            {Object.entries(NETWORKS).map(([id, config]: [string, any]) => (
              <option key={id} value={id} style={{ background: 'var(--bg-surface)' }}>
                {config.name}
              </option>
            ))}
          </select>

          {network === 'custom' && (
            <div
              style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {customProfiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="profile-select"
                    style={{
                      fontSize: '9px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Quick Switch
                  </label>
                  <select
                    id="profile-select"
                    value={activeProfileId || ''}
                    onChange={(e) => switchToCustomProfile(e.target.value)}
                    style={{ ...customInputStyle, fontSize: '11px' }}
                    aria-label="Switch network profile"
                  >
                    <option value="">Select Profile...</option>
                    {customProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label htmlFor="horizon-url" className="sr-only">
                Horizon URL
              </label>
              <input
                id="horizon-url"
                placeholder="Horizon URL"
                key={`horizon-${activeProfileId}`}
                defaultValue={(NETWORKS as any).custom?.horizonUrl}
                style={customInputStyle}
                aria-label="Custom Horizon URL"
                onChange={(e) => updateCustomNetworkConfig({ horizonUrl: e.target.value.trim() })}
              />
              <label htmlFor="soroban-url" className="sr-only">
                Soroban RPC URL
              </label>
              <input
                id="soroban-url"
                placeholder="Soroban RPC URL"
                key={`soroban-${activeProfileId}`}
                defaultValue={(NETWORKS as any).custom?.sorobanUrl}
                style={customInputStyle}
                aria-label="Custom Soroban RPC URL"
                onChange={(e) => updateCustomNetworkConfig({ sorobanUrl: e.target.value.trim() })}
              />
              <label htmlFor="network-passphrase" className="sr-only">
                Network Passphrase
              </label>
              <input
                id="network-passphrase"
                placeholder="Network Passphrase"
                key={`passphrase-${activeProfileId}`}
                defaultValue={(NETWORKS as any).custom?.passphrase}
                style={customInputStyle}
                aria-label="Custom network passphrase"
                onChange={(e) => updateCustomNetworkConfig({ passphrase: e.target.value.trim() })}
              />
              <label htmlFor="api-key" className="sr-only">
                API Key
              </label>
              <input
                id="api-key"
                type="password"
                placeholder="API Key (optional)"
                defaultValue={sessionStorage.getItem(SESSION_API_KEY) || ''}
                style={customInputStyle}
                aria-label="Custom network API key (optional)"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) {
                    sessionStorage.setItem(SESSION_API_KEY, val);
                    updateCustomNetworkConfig({
                      customHeaders: { Authorization: `Bearer ${val}` },
                    });
                  } else {
                    sessionStorage.removeItem(SESSION_API_KEY);
                    updateCustomNetworkConfig({ customHeaders: {} });
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          aria-label="Dashboard sections"
          style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}
        >
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {navItems.map((item, i) => {
              if (item.type === 'header') {
                return (
                  <li key={`header-${i}`} role="presentation">
                    <div
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        padding: '16px 16px 8px',
                        letterSpacing: '1.2px',
                        textTransform: 'uppercase',
                        opacity: 0.8,
                      }}
                      aria-hidden="true"
                    >
                      {item.label}
                    </div>
                  </li>
                );
              }

              const route = item.route;
              const isActive = activeTab === route.id;
              const isDisabled = route.id === 'faucet' && network === 'mainnet';

              return (
                <li key={route.id}>
                  <button
                    type="button"
                    onClick={() => !isDisabled && handleNavClick(route.id)}
                    disabled={isDisabled}
                    className="touch-target"
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={isDisabled ? 'true' : undefined}
                    aria-label={`${route.title}${isDisabled ? ' (unavailable on mainnet)' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      marginBottom: '1px',
                      background: isActive ? 'var(--cyan-glow)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--cyan-dim)' : 'transparent'}`,
                      borderRadius: 'var(--radius-md)',
                      color: isActive
                        ? 'var(--cyan)'
                        : isDisabled
                          ? 'var(--text-muted)'
                          : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      transition: 'var(--transition)',
                      textAlign: 'left',
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !isDisabled) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                      preloadTab(route.id);
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isDisabled) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '15px', opacity: 0.9 }}>
                      {route.icon}
                    </span>
                    {route.title}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        style={{
                          marginLeft: 'auto',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: 'var(--cyan)',
                          boxShadow: '0 0 6px var(--cyan)',
                        }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Connected address */}
        {connectedAddress && (
          <div
            style={{
              padding: '14px 16px',
              borderTop: '1px solid var(--border)',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
            aria-label="Connected account"
          >
            <div
              style={{
                color: 'var(--green)',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--green)',
                  display: 'inline-block',
                }}
              />
              <span>Connected</span>
            </div>
            <div style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>
              <CopyableValue
                value={connectedAddress}
                title="Copy connected public key"
                textStyle={{ display: 'inline-block' }}
              >
                {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-8)}
              </CopyableValue>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: connectedAddress ? 'none' : '1px solid var(--border)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>v0.1.0 · Stellar Dev Dashboard</span>
          <button
            onClick={toggleTheme}
            className="touch-target-sm"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
            }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
