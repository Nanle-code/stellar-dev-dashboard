import React, { useMemo, useState } from "react";
import {
  diffFootprints,
  explainInvalidFootprint,
  describeLedgerKey,
  type FootprintSnapshot,
} from "../../lib/footprintDiff";

const WARNING_TONES: Record<string, { color: string; label: string }> = {
  "unexpected-write": { color: "var(--red)", label: "Unexpected write" },
  "write-grew": { color: "var(--amber)", label: "Footprint growth" },
  "fee-increased": { color: "var(--amber)", label: "Fee increase" },
  "unknown-key-type": { color: "var(--text-muted)", label: "Unclassified key" },
};

function SectionRow({ label, count, color }: { label: string; count: number; color: string }) {
  const countText = Number.isFinite(count) ? String(count) : "—";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color }}>
      {`${countText} ${label}`}
    </span>
  );
}

function KeyList({ keys, tone }: { keys: { type: string; xdr: string }[]; tone: string }) {
  if (keys.length === 0) return null;
  return (
    <ul style={{ margin: "4px 0 0", paddingLeft: "18px", color: tone, fontFamily: "var(--font-mono)", fontSize: "11px" }}>
      {keys.map((key) => (
        <li key={key.xdr}>{describeLedgerKey(key)}</li>
      ))}
    </ul>
  );
}

/**
 * Renders the diff between the previous and current simulation footprint.
 *
 * Failure paths:
 * - A missing/malformed footprint renders an explanatory error instead of throwing.
 * - Diff computation errors are caught and surfaced via `role="alert"`.
 */
export default function FootprintDiffViewer({
  previousFootprint,
  currentFootprint,
}: {
  previousFootprint: FootprintSnapshot | null;
  currentFootprint: FootprintSnapshot | null;
}) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  const { diff, error } = useMemo(() => {
    if (!currentFootprint) return { diff: null, error: null as string | null };

    const invalid = explainInvalidFootprint(currentFootprint);
    if (invalid) return { diff: null, error: invalid };

    if (!previousFootprint) return { diff: null, error: null };

    try {
      return { diff: diffFootprints(previousFootprint, currentFootprint), error: null };
    } catch (err) {
      return {
        diff: null,
        error: err instanceof Error ? err.message : "Unable to compare simulation footprints.",
      };
    }
  }, [previousFootprint, currentFootprint]);

  if (!currentFootprint) {
    return null;
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "13px" }}>
            Footprint Diff
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            {previousFootprint
              ? "Changes relative to the previous simulation of this call."
              : "Run the simulation again to compare footprints between runs."}
          </div>
        </div>
        {diff && (
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(event) => setShowUnchanged(event.target.checked)}
            />
            Show unchanged keys
          </label>
        )}
      </div>

      {error && (
        <div role="alert" style={{ fontSize: "12px", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {!error && !previousFootprint && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Current footprint: {currentFootprint.readOnly.length} read-only, {currentFootprint.readWrite.length} read-write keys.
          {currentFootprint.minResourceFee ? ` Min resource fee: ${currentFootprint.minResourceFee} stroops.` : ""}
        </div>
      )}

      {!error && diff && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <SectionRow label="added" count={diff.summary.addedCount} color="var(--green)" />
            <SectionRow label="removed" count={diff.summary.removedCount} color="var(--red)" />
            <SectionRow label="unchanged" count={diff.summary.unchangedCount} color="var(--text-muted)" />
            {diff.summary.minResourceFeeDelta !== null && (
              <SectionRow
                label={`fee delta (stroops)`}
                count={Number(diff.summary.minResourceFeeDelta)}
                color={Number(diff.summary.minResourceFeeDelta) > 0 ? "var(--amber)" : "var(--text-muted)"}
              />
            )}
          </div>

          {diff.identical && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }} role="status">
              Footprints are identical — no resource access changed between simulations.
            </div>
          )}

          {diff.warnings.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
              {diff.warnings.map((warning, index) => {
                const tone = WARNING_TONES[warning.code] ?? { color: "var(--text-muted)", label: warning.code };
                return (
                  <li
                    key={`${warning.code}-${index}`}
                    style={{
                      borderLeft: `3px solid ${tone.color}`,
                      paddingLeft: "10px",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <strong style={{ color: tone.color }}>{tone.label}:</strong> {warning.message}
                  </li>
                );
              })}
            </ul>
          )}

          {diff.sections.map((section) => {
            const visibleKeys = showUnchanged ? [...section.added, ...section.removed, ...section.unchanged] : [...section.added, ...section.removed];
            if (visibleKeys.length === 0) return null;
            return (
              <div key={section.section} style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  {section.section === "readOnly" ? "Read-only" : "Read-write"} ({section.added.length} added, {section.removed.length} removed)
                </div>
                <KeyList keys={section.added} tone="var(--green)" />
                <KeyList keys={section.removed} tone="var(--red)" />
                {showUnchanged && <KeyList keys={section.unchanged} tone="var(--text-muted)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
