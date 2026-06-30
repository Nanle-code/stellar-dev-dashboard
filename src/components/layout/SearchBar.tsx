import React, { useMemo, useState } from "react";
import { Search, Save, X } from "lucide-react";
import { useSearch } from "../../hooks/useSearch";

export interface SearchResult {
  id: string;
  label: string;
  type: string;
  meta?: string;
  [key: string]: any;
}

export interface SearchBarProps {
  onSelectResult?: (result: SearchResult) => void;
}

export default function SearchBar({ onSelectResult }: SearchBarProps) {
  const {
    query,
    setQuery,
    results,
    savedSearches,
    saveCurrentSearch,
    removeSavedSearch,
    applySavedSearch,
  } = useSearch();
  
  const [nameInput, setNameInput] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);

  const showResults = open && query.trim().length > 0;
  const hasResults = results.length > 0;
  const topSaved = useMemo(() => savedSearches.slice(0, 5), [savedSearches]);

  function handleSave() {
    if (!query.trim()) return;
    const name = nameInput.trim() || `Search ${new Date().toLocaleTimeString()}`;
    saveCurrentSearch(name);
    setNameInput("");
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "8px 10px",
        }}
      >
        <Search size={15} color="var(--text-muted)" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          placeholder="Search transactions, operations, and account data"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
          }}
        />
        <button
          onClick={handleSave}
          title="Save current search"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-sm)",
            padding: "5px",
            display: "flex",
            alignItems: "center",
            cursor: 'pointer'
          }}
        >
          <Save size={14} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "center" }}>
        <input
          value={nameInput}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNameInput(event.target.value)}
          placeholder="Saved search name"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            fontSize: "11px",
            padding: "5px 8px",
            width: "180px",
            fontFamily: "var(--font-mono)",
          }}
        />

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {topSaved.map((entry: any) => (
            <span
              key={entry.name}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              <button
                onClick={() => applySavedSearch(entry)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  cursor: 'pointer'
                }}
              >
                {entry.name}
              </button>
              <button
                onClick={() => removeSavedSearch(entry.name)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  cursor: 'pointer'
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {showResults && (
        <div
          style={{
            position: "absolute",
            zIndex: 1200,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {!hasResults && (
            <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
              No results for this query.
            </div>
          )}
          {results.map((result: SearchResult) => (
            <button
              key={result.id}
              onClick={() => onSelectResult?.(result)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: "var(--text-primary)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                {result.label}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                {result.type} {result.meta ? `• ${result.meta}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}