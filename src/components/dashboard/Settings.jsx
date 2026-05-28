import React, { useMemo, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useStore } from "../../lib/store";
import { getEnvironmentConfig } from "../../lib/config";
import { updateCustomNetworkConfig } from "../../lib/stellar";

const SESSION_API_KEY = 'stellar_custom_api_key';

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export default function Settings() {
  const { network, setNetwork, theme, toggleTheme } = useStore();
  const {
    profiles,
    activeProfile,
    activeProfileName,
    setActiveProfile,
    saveProfile,
    deleteProfile,
    preferences,
    setPreference,
  } = useSettings();

  const [profileName, setProfileName] = useState("");
  const [draftConfig, setDraftConfig] = useState(() => activeProfile.config);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(SESSION_API_KEY) || "");
  const baseline = useMemo(() => getEnvironmentConfig(), []);

  function handleApiKeyChange(val) {
    setApiKey(val);
    if (val) {
      sessionStorage.setItem(SESSION_API_KEY, val);
      updateCustomNetworkConfig({ customHeaders: { Authorization: `Bearer ${val}` } });
    } else {
      sessionStorage.removeItem(SESSION_API_KEY);
      updateCustomNetworkConfig({ customHeaders: {} });
    }
  }

  function handleSaveProfile() {
    const name = profileName.trim() || activeProfileName;
    saveProfile(name, draftConfig);
    setProfileName("");
  }

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700 }}>
        Settings
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px" }}>
          <FieldLabel>Environment</FieldLabel>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            Baseline: {baseline.environment}
          </div>
          <FieldLabel>Network</FieldLabel>
          <select
            value={network}
            onChange={(event) => setNetwork(event.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
            }}
          >
            <option value="testnet">testnet</option>
            <option value="mainnet">mainnet</option>
            <option value="futurenet">futurenet</option>
            <option value="local">local</option>
            <option value="custom">custom</option>
          </select>
          <button
            onClick={toggleTheme}
            style={{
              marginTop: "10px",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              padding: "8px 10px",
            }}
          >
            Toggle Theme ({theme})
          </button>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px" }}>
          <FieldLabel>Preferences</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(preferences).map(([key, value]) => {
              if (typeof value !== "boolean") return null;
              return (
                <label key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(event) => setPreference(key, event.target.checked)}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <FieldLabel>Configuration Profiles</FieldLabel>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={activeProfileName}
            onChange={(event) => {
              setActiveProfile(event.target.value);
              const selected = profiles.find((profile) => profile.name === event.target.value);
              setDraftConfig(selected?.config || getEnvironmentConfig());
            }}
            style={{
              minWidth: "220px",
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => deleteProfile(activeProfileName)}
            disabled={activeProfileName === "default"}
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
            }}
          >
            Delete
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Refresh Interval (ms)
            <input
              type="number"
              value={draftConfig.refreshIntervalMs}
              onChange={(event) => setDraftConfig((prev) => ({ ...prev, refreshIntervalMs: Number(event.target.value) }))}
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Max Results
            <input
              type="number"
              value={draftConfig.maxResults}
              onChange={(event) => setDraftConfig((prev) => ({ ...prev, maxResults: Number(event.target.value) }))}
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Profile name"
            style={{
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              width: "200px",
              fontSize: "12px",
            }}
          />
          <button
            onClick={handleSaveProfile}
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--cyan-dim)",
              background: "var(--cyan-glow)",
              color: "var(--cyan)",
              fontSize: "12px",
            }}
          >
            Save Profile
          </button>
        </div>
      </div>

      {/* Custom Horizon API Key */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <FieldLabel>Custom Horizon API Key</FieldLabel>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Sent as <code>Authorization: Bearer …</code> on custom network requests. Stored in sessionStorage only — cleared on tab close.
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="Paste API key…"
            autoComplete="off"
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
            }}
          />
          {apiKey && (
            <button
              onClick={() => handleApiKeyChange("")}
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                fontSize: "12px",
              }}
            >
              Clear
            </button>
          )}
        </div>
        {apiKey && (
          <div style={{ fontSize: "11px", color: "var(--green)" }}>✓ API key active</div>
        )}
      </div>
    </div>
  );
}
