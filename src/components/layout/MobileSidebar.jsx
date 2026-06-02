/**
 * MobileSidebar (#110).
 *
 * Slide-in navigation drawer for small screens. Renders a hamburger toggle
 * in the fixed mobile header and the full nav list in a side-panel overlay.
 * Closes on nav-item tap, backdrop click, and Escape key.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "account", label: "Account", icon: "◉" },
  { id: "compare", label: "Compare", icon: "◫" },
  { id: "transactions", label: "Transactions", icon: "⇄" },
  { id: "contracts", label: "Contracts", icon: "◻" },
  { id: "assets", label: "Assets", icon: "💎" },
  { id: "network", label: "Network", icon: "◎" },
  { id: "realtime", label: "Real-Time", icon: "◉" },
  { id: "builder", label: "Builder", icon: "⚒" },
  { id: "faucet", label: "Faucet", icon: "⬡" },
  { id: "wallet", label: "Wallet", icon: "⊡" },
  { id: "signer", label: "Signer", icon: "✎" },
  { id: "multisig", label: "Multisig", icon: "⊕" },
  { id: "portfolio", label: "Portfolio", icon: "◐" },
  { id: "charts", label: "Charts", icon: "▤" },
];

/**
 * Hamburger button shown in the mobile top-bar.
 */
export function HamburgerButton() {
  const { isMobileMenuOpen, setMobileMenuOpen } = useStore();
  return (
    <button
      type="button"
      aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isMobileMenuOpen}
      aria-controls="mobile-sidebar"
      onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        minHeight: "var(--touch-target)",
        minWidth: "var(--touch-target)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: "20px",
            height: "2px",
            background: "var(--cyan)",
            borderRadius: "2px",
            transition: "var(--transition)",
          }}
        />
      ))}
    </button>
  );
}

/**
 * Full-screen overlay + slide-in drawer for mobile navigation.
 */
export default function MobileSidebar() {
  const navigate = useNavigate();
  const { activeTab, isMobileMenuOpen, setMobileMenuOpen, theme, toggleTheme, network } =
    useStore();
  const drawerRef = useRef(null);

  const close = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen]);

  const handleNavClick = (tabId) => {
    navigate(`/${tabId}`);
    close();
  };

  // Close on Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handler = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobileMenuOpen, close]);

  // Focus first nav item when opening
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const first = drawerRef.current?.querySelector("button, a");
    first?.focus();
  }, [isMobileMenuOpen]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`mobile-drawer-backdrop${isMobileMenuOpen ? " open" : ""}`}
      />

      {/* Drawer — always in DOM so CSS transition plays on close too */}
      <nav
        id="mobile-sidebar"
        ref={drawerRef}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
        aria-hidden={!isMobileMenuOpen}
        className={`mobile-drawer${isMobileMenuOpen ? " open" : ""}`}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 16px",
            borderBottom: "1px solid var(--border)",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--cyan)",
              letterSpacing: "0.1em",
            }}
          >
            STELLAR DASH
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "18px",
              padding: "4px 8px",
              minHeight: "var(--touch-target-sm)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Network badge */}
        <div style={{ padding: "4px 16px 12px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              padding: "3px 8px",
              borderRadius: "999px",
              background: "var(--cyan-glow-sm)",
              border: "1px solid var(--cyan-dim)",
              color: "var(--cyan)",
              textTransform: "uppercase",
            }}
          >
            {network}
          </span>
        </div>

        {/* Nav items */}
        <ul
          role="list"
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 8px",
            flexGrow: 1,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: isActive ? "var(--cyan-glow-sm)" : "transparent",
                    color: isActive ? "var(--cyan)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontFamily: "var(--font-display)",
                    fontWeight: isActive ? 600 : 400,
                    textAlign: "left",
                    minHeight: "var(--touch-target)",
                    transition: "var(--transition)",
                    borderLeft: isActive ? "2px solid var(--cyan)" : "2px solid transparent",
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: "16px", minWidth: "20px", textAlign: "center" }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer — theme toggle */}
        <div style={{ padding: "16px 16px 0", borderTop: "1px solid var(--border)", marginTop: "8px" }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "var(--font-display)",
              minHeight: "var(--touch-target)",
            }}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </nav>
    </>
  );
}
