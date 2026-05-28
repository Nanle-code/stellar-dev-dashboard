import React, { useMemo, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useStore } from "../../lib/store";
import { getEnvironmentConfig } from "../../lib/config";
import { saveAlertRule, getAlertRules, deleteAlertRule } from "../../lib/alertRulesDb"; // Import IndexedDB helpers
import { ALERT_RULE_TYPE, ALERT_CHANNEL } from "../../lib/alerts"; // Import alert types

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
  const baseline = useMemo(() => getEnvironmentConfig(), []);

  // State for Alert Rules
  const [alertRules, setAlertRules] = useState([]);
  const [newRuleType, setNewRuleType] = useState(ALERT_RULE_TYPE.BALANCE_LOW);
  const [newRuleThreshold, setNewRuleThreshold] = useState(0);
  const [newRuleAssetCode, setNewRuleAssetCode] = useState("XLM");
  const [newRuleChannel, setNewRuleChannel] = useState(ALERT_CHANNEL.EFFECTS);
  const [newRuleAccount, setNewRuleAccount] = useState(""); // Optional: specific account for the rule

  // Load alert rules on component mount
  useEffect(() => {
    async function loadRules() {
      const rules = await getAlertRules();
      setAlertRules(rules);
    }
    loadRules();
  }, []);

  function handleSaveProfile() {
    const name = profileName.trim() || activeProfileName;
    saveProfile(name, draftConfig);
    setProfileName("");
  }

  async function handleAddAlertRule() {
    if (newRuleThreshold < 0) {
      alert("Threshold cannot be negative.");
      return;
    }
    const newRule = { id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, type: newRuleType, threshold: Number(newRuleThreshold), assetCode: newRuleAssetCode.trim().toUpperCase(), channel: newRuleChannel, account: newRuleAccount.trim() || undefined };
    await saveAlertRule(newRule);
    setAlertRules(await getAlertRules()); // Refresh list
    setNewRuleThreshold(0); setNewRuleAssetCode("XLM"); setNewRuleAccount(""); // Reset form fields
  }

  async function handleDeleteAlertRule(ruleId) {
    await deleteAlertRule(ruleId);
    setAlertRules(await getAlertRules()); // Refresh list
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

      {/* New section for Alert Rules */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <FieldLabel>Alert Rules</FieldLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {alertRules.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No alert rules configured.</div>
          ) : (
            alertRules.map((rule) => (
              <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-primary)", background: "var(--bg-elevated)", padding: "8px", borderRadius: "var(--radius-sm)" }}>
                <span>
                  <strong>{rule.type.replace(/_/g, ' ')}</strong>: {rule.threshold} {rule.assetCode} (Channel: {rule.channel}) {rule.account ? `(Account: ${rule.account})` : ''}
                </span>
                <button
                  onClick={() => handleDeleteAlertRule(rule.id)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--red-dim)",
                    background: "var(--red-glow)",
                    color: "var(--red)",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "10px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Alert Type
            <select
              value={newRuleType}
              onChange={(e) => setNewRuleType(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            >
              {Object.values(ALERT_RULE_TYPE).map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Threshold
            <input
              type="number"
              value={newRuleThreshold}
              onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
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
            Asset Code
            <input
              type="text"
              value={newRuleAssetCode}
              onChange={(e) => setNewRuleAssetCode(e.target.value)}
              placeholder="XLM, USD, etc."
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
            Channel
            <select
              value={newRuleChannel}
              onChange={(e) => setNewRuleChannel(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
            >
              {Object.values(ALERT_CHANNEL).map((channel) => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            Specific Account (Optional)
            <input
              type="text"
              value={newRuleAccount}
              onChange={(e) => setNewRuleAccount(e.target.value)}
              placeholder="Account ID"
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

        <button
          onClick={handleAddAlertRule}
          style={{
            marginTop: "10px",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--green-dim)",
            background: "var(--green-glow)",
            color: "var(--green)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Add Alert Rule
        </button>
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
    </div>
  );
}
