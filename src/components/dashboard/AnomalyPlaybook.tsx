import React from 'react';
import { ArrowRight, Activity, Search, Shield } from 'lucide-react';

export interface PlaybookAction {
  id: string;
  label: string;
  type: 'investigate' | 'mitigate' | 'monitor';
  href?: string;
}

export default function AnomalyPlaybook({ 
  anomalyId, 
  actions, 
  onActionClick 
}: { 
  anomalyId: string; 
  actions: PlaybookAction[]; 
  onActionClick: (action: PlaybookAction) => void | Promise<void>;
}) {
  if (!actions || actions.length === 0) {
    return (
      <div data-testid="playbook-empty" style={{ padding: '12px', color: '#6b7280' }}>
        No playbooks available for this anomaly.
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'investigate': return <Search size={16} />;
      case 'mitigate': return <Shield size={16} />;
      case 'monitor': return <Activity size={16} />;
      default: return <ArrowRight size={16} />;
    }
  };

  const handleClick = (e: React.MouseEvent, action: PlaybookAction) => {
    if (!action.href) {
      e.preventDefault();
    }
    onActionClick(action);
  };

  return (
    <div className="anomaly-playbook" style={{ borderTop: '1px solid #374151', paddingTop: '12px', marginTop: '12px' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontWeight: 600 }}>Recommended Actions</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {actions.map((action) => (
          <a
            key={action.id}
            href={action.href || '#'}
            onClick={(e) => handleClick(e, action)}
            data-testid={`action-${action.id}`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 12px', 
              background: 'var(--surface-light, #374151)', 
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            {getIcon(action.type)}
            <span style={{ flex: 1, fontSize: '0.875rem' }}>{action.label}</span>
            <ArrowRight size={14} color="#9ca3af" />
          </a>
        ))}
      </div>
    </div>
  );
}
