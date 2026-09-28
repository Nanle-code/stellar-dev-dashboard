import React, { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import {
  getEmptyStatePreset,
  resolveEmptyStateActions,
  type EmptyStateAction,
  type EmptyStateContext,
} from '../../lib/emptyStates';
import type { ExpertiseTier } from '../../routes/routes';

export interface ContextualEmptyStateProps {
  /** Preset key from `EMPTY_STATE_PRESETS`. Unknown keys fall back to `generic`. */
  context?: EmptyStateContext;
  /** Overrides the preset title. */
  title?: string;
  /** Overrides the preset description. */
  description?: string;
  /** Replaces the preset's actions. */
  actions?: EmptyStateAction[];
  /** Actions rendered before the preset (or overridden) actions, e.g. in-page sub-tab switches. */
  extraActions?: EmptyStateAction[];
  /** Maximum number of actions to show. Defaults to 3. */
  maxActions?: number;
  /** Used to hide routes gated behind a higher expertise tier. */
  expertiseLevel?: ExpertiseTier;
  /** Tighter padding for use inside nested panels. */
  compact?: boolean;
  'data-testid'?: string;
}

export default function ContextualEmptyState({
  context = 'generic',
  title,
  description,
  actions,
  extraActions,
  maxActions,
  expertiseLevel,
  compact = false,
  'data-testid': testId = 'contextual-empty-state',
}: ContextualEmptyStateProps) {
  const { network, activeTab, setActiveTab } = useStore() as {
    network?: string;
    activeTab?: string;
    setActiveTab?: (_tab: string) => void;
  };
  const [actionError, setActionError] = useState<string | null>(null);

  const preset = getEmptyStatePreset(context);
  const resolvedTitle = title ?? preset.title;
  const resolvedDescription = description ?? preset.description;

  const candidateActions = useMemo(
    () => [...(extraActions ?? []), ...(actions ?? preset.actions)],
    [extraActions, actions, preset],
  );
  const resolvedActions = useMemo(
    () =>
      resolveEmptyStateActions(candidateActions, {
        network,
        currentRouteId: activeTab,
        maxActions,
        expertiseLevel,
      }),
    [candidateActions, network, activeTab, maxActions, expertiseLevel],
  );
  // Every suggestion was filtered out (unknown route, hidden, or unsupported on this network).
  const allActionsUnavailable = candidateActions.length > 0 && resolvedActions.length === 0;

  const runAction = (action: EmptyStateAction) => {
    setActionError(null);
    try {
      if (action.onSelect) {
        action.onSelect();
      } else if (action.routeId && typeof setActiveTab === 'function') {
        setActiveTab(action.routeId);
      } else {
        throw new Error('Navigation is unavailable');
      }
    } catch {
      setActionError(`Couldn't open "${action.label}". Try the sidebar instead.`);
    }
  };

  return (
    <div
      role="status"
      data-testid={testId}
      data-context={context}
      style={{
        padding: compact ? '12px 0' : '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: 'var(--text-secondary)',
      }}
    >
      <div>
        <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '13px' }}>
          {resolvedTitle}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>
          {resolvedDescription}
        </div>
      </div>

      {resolvedActions.length > 0 ? (
        <ul
          aria-label="Suggested next steps"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}
        >
          {resolvedActions.map((action) => (
            <li key={action.routeId ?? action.label}>
              <button
                type="button"
                onClick={() => runAction(action)}
                title={action.hint}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '2px',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{action.label} →</span>
                {action.hint && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{action.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : allActionsUnavailable ? (
        <div data-testid="contextual-empty-state-fallback" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          Suggested tools are not available here. Use the sidebar or search to find a related tool.
        </div>
      ) : null}

      {actionError && (
        <div role="alert" style={{ color: 'var(--red)', fontSize: '11px' }}>
          {actionError}
        </div>
      )}
    </div>
  );
}
