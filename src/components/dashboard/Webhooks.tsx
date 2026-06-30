/**
 * Webhooks Dashboard Component
 * UI for managing webhook endpoints and viewing event history
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Play, Check, X, Clock, AlertCircle } from 'lucide-react';
import {
  webhookManager,
  WebhookEndpoint,
  WebhookEvent,
  WebhookEventType,
} from '../../lib/webhooks';

export const Webhooks: React.FC = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allEndpoints, allEvents] = await Promise.all([
        webhookManager.getAllEndpoints(),
        webhookManager.getEventHistory(),
      ]);
      setEndpoints(allEndpoints);
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load webhook data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
    
    try {
      await webhookManager.deleteEndpoint(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete endpoint:', error);
    }
  };

  const handleToggleEndpoint = async (id: string, enabled: boolean) => {
    try {
      await webhookManager.updateEndpoint(id, { enabled: !enabled });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle endpoint:', error);
    }
  };

  const handleTestEndpoint = async (id: string) => {
    try {
      const result = await webhookManager.testEndpoint(id);
      alert(result.message);
      await loadData();
    } catch (error) {
      console.error('Failed to test endpoint:', error);
    }
  };

  const filteredEvents = selectedEndpoint
    ? events.filter((e) => e.endpointId === selectedEndpoint)
    : events;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p>Loading webhooks...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Webhooks</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Configure webhook endpoints for real-time transaction event notifications
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <Plus size={18} />
          Create Endpoint
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Endpoints List */}
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Endpoints</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {endpoints.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: 'var(--card-bg)',
                  borderRadius: '0.5rem',
                  border: '1px dashed var(--border)',
                }}
              >
                <p style={{ color: 'var(--text-secondary)' }}>
                  No webhook endpoints configured yet
                </p>
              </div>
            ) : (
              endpoints.map((endpoint) => (
                <EndpointCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  onDelete={handleDeleteEndpoint}
                  onToggle={handleToggleEndpoint}
                  onTest={handleTestEndpoint}
                  onSelect={() => setSelectedEndpoint(endpoint.id)}
                  isSelected={selectedEndpoint === endpoint.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Event History */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Event History</h2>
            {selectedEndpoint && (
              <button
                onClick={() => setSelectedEndpoint(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Show All
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredEvents.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: 'var(--card-bg)',
                  borderRadius: '0.5rem',
                  border: '1px dashed var(--border)',
                }}
              >
                <p style={{ color: 'var(--text-secondary)' }}>No events yet</p>
              </div>
            ) : (
              filteredEvents.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateEndpointModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

const EndpointCard: React.FC<{
  endpoint: WebhookEndpoint;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (id: string) => void;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ endpoint, onDelete, onToggle, onTest, onSelect, isSelected }) => {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '1.25rem',
        background: isSelected ? 'var(--primary-light)' : 'var(--card-bg)',
        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: endpoint.enabled ? 'var(--success)' : 'var(--text-tertiary)',
              }}
            />
            <code style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{endpoint.url}</code>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {endpoint.events.map((event) => (
              <span
                key={event}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--surface-2)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {event}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTest(endpoint.id);
            }}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            title="Test endpoint"
          >
            <Play size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(endpoint.id, endpoint.enabled);
            }}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: endpoint.enabled ? 'var(--success)' : 'var(--text-secondary)',
            }}
            title={endpoint.enabled ? 'Disable' : 'Enable'}
          >
            {endpoint.enabled ? <Check size={16} /> : <X size={16} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(endpoint.id);
            }}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--danger)',
            }}
            title="Delete endpoint"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {endpoint.lastTriggered && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Last triggered: {new Date(endpoint.lastTriggered).toLocaleString()}
        </p>
      )}
    </div>
  );
};

const EventCard: React.FC<{ event: WebhookEvent }> = ({ event }) => {
  const statusColors = {
    pending: 'var(--warning)',
    delivered: 'var(--success)',
    failed: 'var(--danger)',
    retrying: 'var(--info)',
  };

  const StatusIcon = {
    pending: Clock,
    delivered: Check,
    failed: X,
    retrying: AlertCircle,
  }[event.status];

  return (
    <div
      style={{
        padding: '1rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '0.375rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <StatusIcon size={14} style={{ color: statusColors[event.status] }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: statusColors[event.status] }}>
              {event.status.toUpperCase()}
            </span>
            <span
              style={{
                padding: '0.125rem 0.375rem',
                background: 'var(--surface-2)',
                borderRadius: '0.25rem',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
              }}
            >
              {event.type}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
            {new Date(event.timestamp).toLocaleString()}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
            Attempts: {event.attempts}/{5}
          </p>
          {event.nextRetry && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>
              Next: {new Date(event.nextRetry).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
      {event.error && (
        <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: '0.5rem 0 0', padding: '0.5rem', background: 'var(--danger-bg)', borderRadius: '0.25rem' }}>
          {event.error}
        </p>
      )}
    </div>
  );
};

const CreateEndpointModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['all']);
  const [submitting, setSubmitting] = useState(false);

  const eventTypes: WebhookEventType[] = ['all', 'payment', 'trust', 'contract', 'account_merge'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || selectedEvents.length === 0) return;

    setSubmitting(true);
    try {
      await webhookManager.createEndpoint(url, selectedEvents);
      onSuccess();
    } catch (error) {
      alert('Failed to create endpoint: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEvent = (event: WebhookEventType) => {
    if (event === 'all') {
      setSelectedEvents(['all']);
    } else {
      const filtered = selectedEvents.filter((e) => e !== 'all');
      if (filtered.includes(event)) {
        const updated = filtered.filter((e) => e !== event);
        setSelectedEvents(updated.length > 0 ? updated : ['all']);
      } else {
        setSelectedEvents([...filtered, event]);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          padding: '2rem',
          borderRadius: '0.5rem',
          maxWidth: '500px',
          width: '90%',
          border: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Create Webhook Endpoint</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Endpoint URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Event Types
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {eventTypes.map((event) => (
                <label
                  key={event}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: selectedEvents.includes(event) ? 'var(--primary)' : 'var(--surface-2)',
                    color: selectedEvents.includes(event) ? 'white' : 'var(--text-primary)',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    style={{ display: 'none' }}
                  />
                  {event}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !url || selectedEvents.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating...' : 'Create Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
