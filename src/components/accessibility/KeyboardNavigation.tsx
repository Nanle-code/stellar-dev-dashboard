import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import {
  registerShortcut,
  getRecentAccounts,
  addRecentAccount,
  getTransactionTemplates,
} from "../../utils/accessibility";
import {
  buildPaletteCommands,
  classifyPaletteQuery,
  getPaletteResults,
  getPaletteShortcutLabel,
  resolveTargetPath,
  MAX_QUERY_LENGTH,
} from "../../lib/commandPalette";
import FocusManager from "./FocusManager";
import "../../styles/accessibility.css";

/** Run a storage-backed read without letting a broken store break the palette. */
function safely(read, fallback) {
  try {
    const value = read();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Command Palette Component
 *
 * Keyboard-first navigation to routes, accounts, contracts, and settings (#877).
 * Pasting a G… account address or C… contract ID offers a direct jump; malformed
 * addresses show a validation message instead of silently matching nothing.
 */
export function CommandPalette({ isOpen, onClose, onShowShortcuts = undefined }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const triggerRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const navigate = useNavigate();
  const { setConnectedAddress, setSelectedTemplateId, setPreferencesOpen } = useStore();

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setError(null);
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  // Rebuilt on every open so newly visited accounts / unlocked templates show up.
  const commands = useMemo(
    () =>
      isOpen
        ? buildPaletteCommands({
            recentAccounts: safely(getRecentAccounts, []),
            templates: Object.values(safely(getTransactionTemplates, {})),
          })
        : [],
    [isOpen],
  );

  const parsedQuery = useMemo(() => classifyPaletteQuery(query), [query]);
  const filteredCommands = useMemo(
    () => getPaletteResults(commands, parsedQuery),
    [commands, parsedQuery],
  );

  const groupedCommands = filteredCommands.reduce<Record<string, typeof filteredCommands>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
    setError(null);
  }, [query]);

  const runCommand = (cmd) => {
    const { target } = cmd;
    try {
      if (target.type === "account") {
        setConnectedAddress(target.address);
        // Remembering the account is best-effort: private mode or a full quota
        // must not block navigation.
        safely(() => addRecentAccount(target.address), undefined);
      } else if (target.type === "template") {
        setSelectedTemplateId(target.templateId);
      } else if (target.type === "preferences") {
        setPreferencesOpen(true);
      } else if (target.type === "shortcuts") {
        onShowShortcuts?.();
      }

      const path = resolveTargetPath(target);
      if (path) navigate(path);
      onClose();
    } catch (err) {
      console.error("Command palette action failed:", err);
      setError(`Couldn't run "${cmd.label}". Please try again.`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.max(0, Math.min(prev + 1, filteredCommands.length - 1)),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        runCommand(filteredCommands[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const invalidReason = parsedQuery.kind === "invalid" ? parsedQuery.reason : null;
  const activeCommand = filteredCommands[selectedIndex];

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      <FocusManager trapFocus restoreFocusOnUnmount returnFocusElement={triggerRef.current}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-bright)",
            borderRadius: "var(--radius-lg)",
            width: "90%",
            maxWidth: "600px",
            maxHeight: "70vh",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
          >
            <label htmlFor="command-palette-input" className="sr-only">
              Search commands, or paste an account address or contract ID
            </label>
            <div style={{ position: 'relative' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}>🔍</span>
              <input
                id="command-palette-input"
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={filteredCommands.length > 0}
                aria-controls="command-palette-listbox"
                aria-autocomplete="list"
                aria-invalid={invalidReason ? true : undefined}
                aria-describedby={invalidReason ? "command-palette-invalid" : undefined}
                autoComplete="off"
                spellCheck={false}
                maxLength={MAX_QUERY_LENGTH * 2}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, settings, or paste a G… / C… address"
                aria-activedescendant={
                  activeCommand ? `command-option-${activeCommand.id}` : undefined
                }
                style={{
                  width: "100%",
                  background: "var(--bg-elevated)",
                  border: `1px solid ${invalidReason ? "var(--red, #ff4d6d)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px 12px 40px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>
            {error && (
              <div role="alert" style={{ marginTop: "8px", fontSize: "12px", color: "var(--red, #ff4d6d)" }}>
                {error}
              </div>
            )}
          </div>

        <div
          id="command-palette-listbox"
          role="listbox"
          aria-label="Commands"
          style={{ maxHeight: "calc(70vh - 130px)", overflowY: "auto" }}
        >
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} role="group" aria-label={category}>
              <div
                aria-hidden="true"
                style={{
                  padding: "8px 16px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  background: "var(--bg-elevated)",
                  borderBottom: '1px solid var(--border)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {category}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <div
                    key={cmd.id}
                    id={`command-option-${cmd.id}`}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => runCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: isSelected ? "var(--cyan-glow)" : "transparent",
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: "var(--transition)",
                    }}
                  >
                    <div style={{ fontSize: "13px", color: isSelected ? "var(--cyan)" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>
                      {cmd.label}
                    </div>
                    {isSelected && <span aria-hidden="true" style={{ fontSize: '12px', color: 'var(--cyan)' }}>↵</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

          {invalidReason && (
            <div id="command-palette-invalid" role="alert" style={{ padding: "32px", textAlign: "center", color: "var(--red, #ff4d6d)", fontSize: "13px" }}>
              {invalidReason}
            </div>
          )}

          {!invalidReason && filteredCommands.length === 0 && (
            <div role="status" style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No matching commands found
            </div>
          )}

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "16px",
            fontSize: "11px",
            color: "var(--text-muted)",
            background: 'var(--bg-elevated)'
          }}
        >
          <span><kbd style={{ background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '3px' }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '3px' }}>↵</kbd> Select</span>
          <span><kbd style={{ background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '3px' }}>Esc</kbd> Close</span>
          <span style={{ marginLeft: 'auto' }}><kbd style={{ background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '3px' }}>{getPaletteShortcutLabel()}</kbd> Open</span>
        </div>
        </div>
      </FocusManager>
    </div>
  );
}

/**
 * Keyboard Shortcuts Help Modal
 */
function ShortcutsHelp({ isOpen, onClose }) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Meta' && e.key !== 'Alt')) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: "Ctrl/Cmd + K", description: "Open command palette" },
    { key: "Ctrl/Cmd + /", description: "Show keyboard shortcuts" },
    { key: "G then D", description: "Go to Dashboard" },
    { key: "G then A", description: "Go to Account" },
    { key: "G then T", description: "Go to Transactions" },
    { key: "G then C", description: "Go to Contracts" },
    { key: "G then X", description: "Go to DEX Explorer" },
    { key: "G then S", description: "Go to Asset Discovery" },
    { key: "G then G", description: "Scroll to top" },
    { key: "Ctrl/Cmd + B", description: "Open Transaction Builder" },
    { key: "Escape", description: "Close modals/dialogs" },
    { key: "?", description: "Show this help" },
  ];

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <FocusManager trapFocus restoreFocusOnUnmount returnFocusElement={triggerRef.current}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-help-title"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-bright)",
            borderRadius: "var(--radius-lg)",
            width: "90%",
            maxWidth: "500px",
            maxHeight: "85vh",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: 'var(--bg-elevated)'
            }}
          >
            <h2 id="shortcuts-help-title" style={{ fontSize: "18px", fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span aria-hidden="true">⌨️</span> Keyboard Shortcuts
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close keyboard shortcuts"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "24px",
                padding: 0,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

        <div style={{ padding: "16px 24px", overflowY: 'auto' }}>
          {shortcuts.map((shortcut, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom:
                  idx < shortcuts.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {shortcut.description}
              </span>
              <kbd
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--cyan)",
                  boxShadow: '0 2px 0 var(--border)'
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        
        <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Press Escape or any other key to close this overlay.
        </div>
        </div>
      </FocusManager>
    </div>
  );
}

/**
 * Enhanced Keyboard Navigation with Command Palette and Shortcuts
 */
const KeyboardNavigation = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const { setActiveTab } = useStore();
  const gKeyPressed = useRef(false);
  const gKeyTimeout = useRef(null);

  useEffect(() => {
    // Command Palette: Ctrl/Cmd + K
    const unregisterCmdK = registerShortcut("meta+k", () => setCommandPaletteOpen(true));
    const unregisterCtrlK = registerShortcut("ctrl+k", () => setCommandPaletteOpen(true));

    // Shortcuts Help: Ctrl/Cmd + / or ?
    const unregisterHelp1 = registerShortcut("meta+/", () => setShortcutsHelpOpen(true));
    const unregisterHelp2 = registerShortcut("ctrl+/", () => setShortcutsHelpOpen(true));
    const unregisterHelp3 = registerShortcut("shift+/", () => setShortcutsHelpOpen(true));

    // Navigation Shortcuts
    const unregisterBuilder1 = registerShortcut("meta+b", () => setActiveTab("builder"));
    const unregisterBuilder2 = registerShortcut("ctrl+b", () => setActiveTab("builder"));

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
        if (e.key === "Escape") {
          setCommandPaletteOpen(false);
          setShortcutsHelpOpen(false);
        }
        return;
      }

      const key = e.key.toLowerCase();

      // G + key navigation
      if (key === "g") {
        if (gKeyPressed.current) {
          // Double G press - go to top
          window.scrollTo({ top: 0, behavior: "smooth" });
          gKeyPressed.current = false;
          clearTimeout(gKeyTimeout.current);
        } else {
          gKeyPressed.current = true;
          gKeyTimeout.current = setTimeout(() => {
            gKeyPressed.current = false;
          }, 800);
        }
      } else if (gKeyPressed.current) {
        let matched = true;
        switch (key) {
          case "d": setActiveTab("overview"); break;
          case "a": setActiveTab("account"); break;
          case "t": setActiveTab("transactions"); break;
          case "c": setActiveTab("contracts"); break;
          case "x": setActiveTab("dex"); break;
          case "s": setActiveTab("assets"); break;
          default: matched = false;
        }
        
        if (matched) {
          e.preventDefault();
          gKeyPressed.current = false;
          clearTimeout(gKeyTimeout.current);
        }
      }
      
      // Escape to close everything
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setShortcutsHelpOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      unregisterCmdK(); unregisterCtrlK();
      unregisterHelp1(); unregisterHelp2(); unregisterHelp3();
      unregisterBuilder1(); unregisterBuilder2();
      document.removeEventListener("keydown", handleKeyDown);
      if (gKeyTimeout.current) clearTimeout(gKeyTimeout.current);
    };
  }, [setActiveTab]);

  return (
    <>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onShowShortcuts={() => setShortcutsHelpOpen(true)}
      />

      <ShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </>
  );
};

export default KeyboardNavigation;
