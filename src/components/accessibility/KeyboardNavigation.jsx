import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../lib/store";
import {
  registerShortcut,
  getRecentAccounts,
  addRecentAccount,
  getTransactionTemplates,
} from "../../utils/accessibility";
import "../../styles/accessibility.css";

/**
 * Command Palette Component
 */
function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { setConnectedAddress, setActiveTab, setSelectedTemplateId } = useStore();

  const commands = [
    // Navigation
    { id: "nav-dashboard", label: "Go to Dashboard", category: "Navigation", action: () => setActiveTab("overview") },
    { id: "nav-account", label: "Go to Account", category: "Navigation", action: () => setActiveTab("account") },
    { id: "nav-transactions", label: "Go to Transactions", category: "Navigation", action: () => setActiveTab("transactions") },
    { id: "nav-contracts", label: "Go to Contracts", category: "Navigation", action: () => setActiveTab("contracts") },
    { id: "nav-assets", label: "Go to Asset Discovery", category: "Navigation", action: () => setActiveTab("assets") },
    { id: "nav-dex", label: "Go to DEX Explorer", category: "Navigation", action: () => setActiveTab("dex") },
    { id: "nav-analytics", label: "Go to Analytics", category: "Navigation", action: () => setActiveTab("analytics") },
    { id: "nav-settings", label: "Go to Settings", category: "Navigation", action: () => setActiveTab("settings") },

    // Quick Actions
    { id: "action-builder", label: "Open Transaction Builder", category: "Actions", action: () => setActiveTab("txBuilder") },
    { id: "action-faucet", label: "Request Testnet Funds", category: "Actions", action: () => setActiveTab("faucet") },
    { id: "action-compare", label: "Compare Accounts", category: "Actions", action: () => setActiveTab("compare") },

    // Recent Accounts
    ...getRecentAccounts().map((acc) => ({
      id: `account-${acc.publicKey}`,
      label: `Switch to ${acc.publicKey.slice(0, 8)}...${acc.publicKey.slice(-4)}`,
      category: "Recent Accounts",
      action: () => {
        setConnectedAddress(acc.publicKey);
        addRecentAccount(acc.publicKey);
        setActiveTab("account");
        onClose();
      },
    })),

    // Templates
    ...Object.values(getTransactionTemplates()).map((template) => ({
      id: `template-${template.id}`,
      label: `Load Template: ${template.label || template.name || template.id}`,
      category: "Templates",
      action: () => {
        setSelectedTemplateId(template.id);
        setActiveTab("txBuilder");
        onClose();
      },
    })),
  ];

  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.category.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
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
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredCommands.length - 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
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
      <div
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
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands, pages, accounts..."
              style={{
                width: "100%",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px 12px 40px",
                fontSize: "14px",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ maxHeight: "calc(70vh - 130px)", overflowY: "auto" }}>
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div
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
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
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
                    {isSelected && <span style={{ fontSize: '12px', color: 'var(--cyan)' }}>↵</span>}
                  </div>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No matching commands found
            </div>
          )}
        </div>

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
        </div>
      </div>
    </div>
  );
}

/**
 * Keyboard Shortcuts Help Modal
 */
function ShortcutsHelp({ isOpen, onClose }) {
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
      <div
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⌨️</span> Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
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
          Press any key to close this overlay.
        </div>
      </div>
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
      />

      <ShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </>
  );
};

export default KeyboardNavigation;
