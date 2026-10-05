/**
 * AuthorizationTree — #850
 *
 * Renders the nested authorization entries returned by a Soroban simulation.
 * Each entry describes which signer is required and the full tree of
 * contract invocations they must authorize, including cross-contract calls.
 *
 * Props:
 *   authEntries  — Array of SerializedAuthEntry from simulateContractCall.
 *                  Renders nothing when the array is empty.
 *   className    — Optional CSS class forwarded to the outer wrapper.
 *
 * Security note:
 *   Values displayed here come from XDR data returned by the Soroban RPC.
 *   All values are treated as untrusted display text and rendered through
 *   React's normal string escaping — no dangerouslySetInnerHTML is used.
 *   Signers should independently verify authorization entries before signing.
 */

import React, { useState } from 'react';
import { Shield, ChevronRight, ChevronDown, Key, User, Lock, Code } from 'lucide-react';
import type { SerializedAuthEntry, SerializedAuthInvocation } from '../../lib/stellar';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function truncateAddress(address: string, leadingChars = 8, trailingChars = 6): string {
  if (!address || address.length <= leadingChars + trailingChars + 3) return address;
  return `${address.slice(0, leadingChars)}…${address.slice(-trailingChars)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InvocationNodeProps {
  invocation: SerializedAuthInvocation;
  depth?: number;
}

/**
 * Renders a single invocation node and, recursively, all its sub-invocations.
 * Nodes at depth > 0 are indented with a connecting tree-line gutter.
 */
function InvocationNode({ invocation, depth = 0 }: InvocationNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = invocation.subInvocations.length > 0;

  const functionLabel: string = (() => {
    if (invocation.functionType === 'contract_fn') {
      return invocation.functionName || '(unknown function)';
    }
    if (invocation.functionType === 'create_contract') return 'create_contract';
    if (invocation.functionType === 'create_contract_v2') return 'create_contract_v2';
    return '(unknown)';
  })();

  const contractLabel =
    invocation.functionType === 'contract_fn' && invocation.contractAddress
      ? truncateAddress(invocation.contractAddress)
      : null;

  return (
    <div
      style={{
        paddingLeft: depth > 0 ? '20px' : '0',
        borderLeft: depth > 0 ? '1px solid var(--border)' : 'none',
        marginLeft: depth > 0 ? '10px' : '0',
      }}
    >
      {/* Node header row */}
      <div
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-level={depth + 1}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '8px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          marginBottom: '6px',
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={hasChildren ? () => setExpanded((v) => !v) : undefined}
      >
        {/* Expand/collapse toggle */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            marginTop: '2px',
            color: 'var(--text-muted)',
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <Code
          size={14}
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: '2px', color: 'var(--cyan)' }}
        />

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Function name */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
            }}
          >
            {functionLabel}
          </div>

          {/* Contract address */}
          {contractLabel && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
              title={invocation.contractAddress}
            >
              {contractLabel}
            </div>
          )}

          {/* Argument count */}
          {invocation.args.length > 0 && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginTop: '3px',
              }}
            >
              {invocation.args.length} arg{invocation.args.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Sub-invocation badge */}
        {invocation.subInvocations.length > 0 && (
          <span
            aria-label={`${invocation.subInvocations.length} sub-invocation${invocation.subInvocations.length !== 1 ? 's' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9px',
              background: 'var(--cyan-glow, rgba(0,255,255,0.1))',
              border: '1px solid var(--cyan-dim, rgba(0,255,255,0.3))',
              color: 'var(--cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: 700,
            }}
          >
            {invocation.subInvocations.length}
          </span>
        )}
      </div>

      {/* Recursive children */}
      {hasChildren && expanded && (
        <div role="group">
          {invocation.subInvocations.map((sub, idx) => (
            <InvocationNode key={idx} invocation={sub} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CredentialsBadgeProps {
  entry: SerializedAuthEntry;
}

function CredentialsBadge({ entry }: CredentialsBadgeProps) {
  const { credentials } = entry;

  if (credentials.type === 'source_account') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}
      >
        <User size={13} style={{ color: '#22c55e', flexShrink: 0 }} aria-hidden="true" />
        <span
          style={{
            fontSize: '11px',
            color: '#22c55e',
            fontWeight: 600,
          }}
        >
          Source Account
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          (transaction signer)
        </span>
      </div>
    );
  }

  // Address credentials
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(249, 115, 22, 0.08)',
        border: '1px solid rgba(249, 115, 22, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <Key size={13} style={{ color: '#f97316', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: '11px', color: '#f97316', fontWeight: 600 }}>
          Address Signature Required
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-primary)',
          wordBreak: 'break-all',
        }}
        title={credentials.address}
      >
        {credentials.address}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '4px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        <span>Nonce: {credentials.nonce}</span>
        <span>Expires ledger: {credentials.signatureExpirationLedger}</span>
      </div>
    </div>
  );
}

// ─── Primary export ───────────────────────────────────────────────────────────

export interface AuthorizationTreeProps {
  /** Authorization entries from simulateContractCall. */
  authEntries: SerializedAuthEntry[];
  /** Optional additional CSS class for the outer wrapper. */
  className?: string;
}

/**
 * AuthorizationTree renders the authorization entries returned by a Soroban
 * simulation so developers can verify which accounts need to sign and what
 * invocations they are authorizing before committing a transaction.
 *
 * Returns `null` when `authEntries` is empty or not provided, so callers can
 * render it unconditionally after a simulation result arrives.
 */
export default function AuthorizationTree({ authEntries, className }: AuthorizationTreeProps) {
  // Input guard: gracefully handle non-array values (e.g. legacy result without
  // this field, or a direct rendering error).
  if (!Array.isArray(authEntries) || authEntries.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      role="tree"
      aria-label="Contract authorization tree"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Shield
          size={16}
          aria-hidden="true"
          style={{ color: 'var(--cyan)', flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Authorization Requirements
        </span>
        <span
          aria-label={`${authEntries.length} signer${authEntries.length !== 1 ? 's' : ''} required`}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '10px',
            background: 'var(--cyan-glow, rgba(0,255,255,0.1))',
            border: '1px solid var(--cyan-dim, rgba(0,255,255,0.3))',
            color: 'var(--cyan)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {authEntries.length} signer{authEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Security notice */}
      <div
        role="note"
        style={{
          padding: '8px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(249, 115, 22, 0.06)',
        }}
      >
        <Lock size={12} aria-hidden="true" style={{ color: '#f97316', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Review all authorization entries before signing. Each entry represents a signer whose
          private key will be used to authorize the invocations listed below.
        </span>
      </div>

      {/* Auth entry list */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {authEntries.map((entry, idx) => (
          <section
            key={idx}
            aria-label={`Authorization entry ${idx + 1}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Entry header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                Signer {idx + 1}
              </span>
              {authEntries.length > 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'var(--border)',
                  }}
                />
              )}
            </div>

            {/* Credentials */}
            <CredentialsBadge entry={entry} />

            {/* Invocation tree */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  marginBottom: '8px',
                }}
              >
                Authorized Invocations
              </div>
              <InvocationNode invocation={entry.rootInvocation} depth={0} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
