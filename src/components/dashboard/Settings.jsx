import React, { useState, useEffect, useCallback } from 'react';
import {
  canInstall,
  promptInstall,
  onUpdateReady,
  applyUpdate,
  isOffline,
  onNetworkChange,
} from '../../utils/offline.js';

// ─── Inline styles (project uses inline styles throughout) ───────────────────
const styles = {
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    marginBottom: '0.75rem',
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  label: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  description: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    marginTop: '0.25rem',
  },
  button: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s',
  },
  primaryButton: {
    background: 'var(--color-accent)',
    color: '#fff',
  },
  secondaryButton: {
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '0.75rem',
    fontSize: '0.8125rem',
  },
  updateBanner: {
    background: 'rgba(99, 179, 237, 0.12)',
    border: '1px solid rgba(99, 179, 237, 0.35)',
    color: 'var(--color-text)',
  },
  offlineBanner: {
    background: 'rgba(252, 129, 74, 0.12)',
    border: '1px solid rgba(252, 129, 74, 0.4)',
    color: 'var(--color-text)',
  },
  dot: {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '50%',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    fontFamily: 'Space Mono, monospace',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  const initialCustomHeaders = getCustomNetworkAuthHeaders();
  const initialHeaderName = Object.keys(initialCustomHeaders)[0] || "Authorization";
  const { network, setNetwork, theme, toggleTheme, setActiveTab } = useStore();
  const {
    profiles,
    activeProfile,
    activeProfileName,
    setActiveProfile: setConfigProfile,
    saveProfile,
    deleteProfile,
    preferences,
    setPreference,
  } = useSettings();

  // Custom network profile state (Issue #188)
  const [customProfiles, setCustomProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [horizonUrl, setHorizonUrl] = useState("");
  const [sorobanUrl, setSorobanUrl] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [draftConfig, setDraftConfig] = useState(() => activeProfile.config);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(SESSION_API_KEY) || "");
  const baseline = useMemo(() => getEnvironmentConfig(), []);

  // State for Alert Rules
  const [alertRules, setAlertRules] = useState([]);
  const [newRuleType, setNewRuleType] = useState(ALERT_RULE_TYPE.BALANCE_LOW);
  const [newRuleThreshold, setNewRuleThreshold] = useState(0);
  const [newRuleAssetCode, setNewRuleAssetCode] = useState("XLM");
  const [newRuleChannel, setNewRuleChannel] = useState(ALERT_CHANNEL.EFFECTS);
  const [newRuleAccount, setNewRuleAccount] = useState(""); // Optional: specific account for the rule

  // Poll canInstall every second — the beforeinstallprompt event can fire after
  // the component mounts, so we need to re-check.
  useEffect(() => {
    const interval = setInterval(() => {
      setInstallable(canInstall());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to SW update events
  useEffect(() => {
    const unsub = onUpdateReady(() => setUpdateReady(true));
    return unsub;
  }, []);

  // Subscribe to network changes
  useEffect(() => {
    const unsub = onNetworkChange((online) => setOffline(!online));
    return unsub;
  }, []);

  const handleInstall = useCallback(async () => {
    const outcome = await promptInstall();
    setInstallOutcome(outcome);
    setInstallable(canInstall());
  }, []);

  const handleUpdate = useCallback(() => {
    applyUpdate();
  }, []);

  return (
    <div style={{ maxWidth: '640px', padding: '1.5rem 0' }}>
      <h2
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '1.25rem',
          fontWeight: 700,
          marginBottom: '1.5rem',
          color: 'var(--color-text)',
        }}
      >
        Settings
      </h2>

      {/* ── Update banner ── */}
      {updateReady && (
        <div style={{ ...styles.banner, ...styles.updateBanner }}>
          <span style={{ ...styles.dot, background: '#63b3ed' }} />
          <span style={{ flex: 1 }}>
            A new version of Stellar Dev Dashboard is available.
          </span>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleUpdate}
          >
            Update now
          </button>
        </div>
      )}

      {/* ── Offline banner ── */}
      {offline && (
        <div style={{ ...styles.banner, ...styles.offlineBanner }}>
          <span style={{ ...styles.dot, background: '#fc814a' }} />
          <span>
            You&apos;re offline. The app shell loads from cache, but live
            account data requires a network connection.
          </span>
        </div>
      )}

      {/* ── Install app section ── */}
      <div style={styles.section}>
        <p style={styles.sectionTitle}>App Installation</p>

        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.label}>Install Stellar Dev Dashboard</p>
              <p style={styles.description}>
                Add to your home screen or desktop for a native-like experience
                with offline app shell support.
              </p>
              {installOutcome === 'accepted' && (
                <p style={{ ...styles.description, color: 'var(--color-success, #68d391)', marginTop: '0.4rem' }}>
                  ✓ Installing…
                </p>
              )}
              {installOutcome === 'dismissed' && (
                <p style={{ ...styles.description, marginTop: '0.4rem' }}>
                  Dismissed. You can try again later.
                </p>
              )}
            </div>

            {installable && installOutcome !== 'accepted' ? (
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleInstall}
              >
                Install app
              </button>
            ) : (
              <span
                style={{
                  ...styles.badge,
                  background: installOutcome === 'accepted'
                    ? 'rgba(104, 211, 145, 0.15)'
                    : 'var(--color-surface-raised)',
                  color: installOutcome === 'accepted'
                    ? '#68d391'
                    : 'var(--color-text-muted)',
                  border: `1px solid ${
                    installOutcome === 'accepted'
                      ? 'rgba(104, 211, 145, 0.3)'
                      : 'var(--color-border)'
                  }`,
                }}
              >
                {installOutcome === 'accepted' ? 'Installing' : 'Not available'}
              </span>
            )}
          </div>
        </div>

        {/* Offline capability info */}
        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.label}>Offline App Shell</p>
              <p style={styles.description}>
                The dashboard UI loads from the service worker cache when
                offline. Live account data and Horizon responses are always
                fetched fresh from the network.
              </p>
            </div>
            <span
              style={{
                ...styles.badge,
                background: 'rgba(104, 211, 145, 0.15)',
                color: '#68d391',
                border: '1px solid rgba(104, 211, 145, 0.3)',
              }}
            >
              Active
            </span>
          </div>
        </div>
      </div>

      {/* ── Network status section ── */}
      <div style={styles.section}>
        <p style={styles.sectionTitle}>Network</p>
        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.label}>Connection status</p>
              <p style={styles.description}>
                {offline
                  ? 'Offline — account data unavailable until reconnected.'
                  : 'Online — all features available.'}
              </p>
            </div>
            <span
              style={{
                ...styles.badge,
                background: offline
                  ? 'rgba(252, 129, 74, 0.12)'
                  : 'rgba(104, 211, 145, 0.15)',
                color: offline ? '#fc814a' : '#68d391',
                border: `1px solid ${
                  offline
                    ? 'rgba(252, 129, 74, 0.4)'
                    : 'rgba(104, 211, 145, 0.3)'
                }`,
              }}
            >
              {offline ? 'Offline' : 'Online'}
            </span>
          </div>
        </div>
      </div>

      {/* ── App update section ── */}
      <div style={styles.section}>
        <p style={styles.sectionTitle}>Updates</p>
        <div style={styles.card}>
          <div style={styles.row}>
            <div>
              <p style={styles.label}>App version</p>
              <p style={styles.description}>
                {updateReady
                  ? 'A new version has been downloaded and is ready to apply.'
                  : 'You are running the latest version.'}
              </p>
            </div>
            {updateReady ? (
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleUpdate}
              >
                Reload &amp; update
              </button>
            ) : (
              <span
                style={{
                  ...styles.badge,
                  background: 'rgba(104, 211, 145, 0.15)',
                  color: '#68d391',
                  border: '1px solid rgba(104, 211, 145, 0.3)',
                }}
              >
                Up to date
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Performance
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          View Core Web Vitals, bundle analysis, and performance budget violations.
        </div>
        <button
          onClick={() => setActiveTab('performance')}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--cyan-dim)',
            background: 'var(--cyan-glow)',
            color: 'var(--cyan)',
            fontSize: '12px',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Open Performance Monitor
        </button>
      </div>
    </div>
  );
}