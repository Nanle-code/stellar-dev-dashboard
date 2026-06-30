import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useRateLimiter } from "../../hooks/useRateLimiter";
import { useStore } from "../../lib/store";
import { getEnvironmentConfig } from "../../lib/config";
import { getCustomNetworkAuthHeaders } from "../../lib/stellar";
import { saveAlertRule, getAlertRules, deleteAlertRule } from "../../lib/alertRulesDb";
import { ALERT_RULE_TYPE, ALERT_CHANNEL } from "../../lib/alerts";
import PluginRegistryView from "./PluginRegistryView";
import DataExport from "./DataExport";

const SESSION_API_KEY = 'stellar_custom_api_key';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function ErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div style={{
      fontSize: "11px",
      color: "var(--error)",
      marginTop: "4px",
      padding: "6px 8px",
      background: "rgba(255, 0, 0, 0.1)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--error)"
    }}>
      {message}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    marginBottom: '1rem',
  },
  updateBanner: {
    background: 'rgba(99, 179, 237, 0.1)',
    border: '1px solid rgba(99, 179, 237, 0.3)',
    color: '#63b3ed',
  },
  offlineBanner: {
    background: 'rgba(252, 129, 74, 0.1)',
    border: '1px solid rgba(252, 129, 74, 0.3)',
    color: '#fc814a',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: '0 0 0.75rem 0',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    color: 'var(--color-text)',
    fontWeight: 600,
    margin: '0 0 4px 0',
  },
  description: {
    fontSize: '12px',
    color: 'var(--color-text-muted)',
    margin: 0,
  },
  button: {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  primaryButton: {
    background: 'var(--cyan)',
    color: '#000',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};

function canInstall(): boolean { return false; }
function onUpdateReady(cb: () => void): () => void { return () => {}; }
function onNetworkChange(cb: (online: boolean) => void): () => void { return () => {}; }
function promptInstall(): Promise<string | null> { return Promise.resolve(null); }
function applyUpdate(): void {}

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

  const [customProfiles, setCustomProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [horizonUrl, setHorizonUrl] = useState("");
  const [sorobanUrl, setSorobanUrl] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [draftConfig, setDraftConfig] = useState(() => activeProfile.config);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(SESSION_API_KEY) || "");
  const baseline = useMemo(() => getEnvironmentConfig(), []);

  const [alertRules, setAlertRules] = useState<Array<Record<string, unknown>>>([]);
  const [newRuleType, setNewRuleType] = useState(ALERT_RULE_TYPE.BALANCE_LOW);
  const [newRuleThreshold, setNewRuleThreshold] = useState(0);
  const [newRuleAssetCode, setNewRuleAssetCode] = useState("XLM");
  const [newRuleChannel, setNewRuleChannel] = useState(ALERT_CHANNEL.EFFECTS);
  const [newRuleAccount, setNewRuleAccount] = useState("");

  const [installable, setInstallable] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setInstallable(canInstall());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = onUpdateReady(() => setUpdateReady(true));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onNetworkChange((online: boolean) => setOffline(!online));
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

      {updateReady && (
        <div style={{ ...styles.banner, ...styles.updateBanner } as React.CSSProperties}>
          <span style={{ ...styles.dot, background: '#63b3ed' } as React.CSSProperties} />
          <span style={{ flex: 1 }}>
            A new version of Stellar Dev Dashboard is available.
          </span>
          <button
            style={{ ...styles.button, ...styles.primaryButton } as React.CSSProperties}
            onClick={handleUpdate}
          >
            Update now
          </button>
        </div>
      )}

      {offline && (
        <div style={{ ...styles.banner, ...styles.offlineBanner } as React.CSSProperties}>
          <span style={{ ...styles.dot, background: '#fc814a' } as React.CSSProperties} />
          <span>
            You&apos;re offline. The app shell loads from cache, but live
            account data requires a network connection.
          </span>
        </div>
      )}

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
                <p style={{ ...styles.description, color: 'var(--color-success, #68d391)', marginTop: '0.4rem' } as React.CSSProperties}>
                  ✓ Installing…
                </p>
              )}
              {installOutcome === 'dismissed' && (
                <p style={{ ...styles.description, marginTop: '0.4rem' } as React.CSSProperties}>
                  Dismissed. You can try again later.
                </p>
              )}
            </div>

            {installable && installOutcome !== 'accepted' ? (
              <button
                style={{ ...styles.button, ...styles.primaryButton } as React.CSSProperties}
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
                } as React.CSSProperties}
              >
                {installOutcome === 'accepted' ? 'Installing' : 'Not available'}
              </span>
            )}
          </div>
        </div>

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
              } as React.CSSProperties}
            >
              Active
            </span>
          </div>
        </div>
      </div>

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
              } as React.CSSProperties}
            >
              {offline ? 'Offline' : 'Online'}
            </span>
          </div>
        </div>
      </div>

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
                style={{ ...styles.button, ...styles.primaryButton } as React.CSSProperties}
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
                } as React.CSSProperties}
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

      <div style={styles.section}>
        <p style={styles.sectionTitle}>Extensions</p>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Review installed plugins, manage permissions, and install sandboxed marketplace extensions.
        </div>
        <PluginRegistryView placement="settings" />
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <FieldLabel>Export &amp; Import</FieldLabel>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
          Download your account data and settings, or restore from a backup file.
        </div>
        <DataExport />
      </div>
    </div>
  );
}
