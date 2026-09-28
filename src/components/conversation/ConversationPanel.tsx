/**
 * ConversationPanel — Main conversational navigation interface (#555)
 *
 * Floating chat panel that allows users to navigate the dashboard
 * using natural language commands. Supports voice input and provides
 * suggestion chips for command discoverability.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationNavigation } from '../../hooks/useConversationNavigation';
import MessageBubble from './MessageBubble';
import VoiceInput from './VoiceInput';
import NavigationChips from './NavigationChips';
import type { NavCommand } from '../../lib/navigationClassifier';

interface ConversationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationPanel({ isOpen, onClose }: ConversationPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isProcessing,
    isListening,
    isVoiceSupported,
    sendMessage,
    startListening,
    stopListening,
    clearConversation,
  } = useConversationNavigation();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isProcessing) return;
      sendMessage(inputValue);
      setInputValue('');
    },
    [inputValue, isProcessing, sendMessage]
  );

  const handleChipSelect = useCallback(
    (cmd: NavCommand) => {
      sendMessage(cmd.aliases[0] || cmd.label);
    },
    [sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="conversation-panel"
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '380px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        zIndex: 1060,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'chatSlideIn 0.3s ease',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--cyan)',
              boxShadow: '0 0 6px var(--cyan)',
              animation: 'pulse 2s infinite ease-in-out',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Navigation Assistant
          </span>
          <span
            style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              background: 'var(--bg-hover)',
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            BETA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={clearConversation}
            title="Clear conversation"
            aria-label="Clear conversation"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            ↻
          </button>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close navigation assistant"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          background: 'var(--bg-base)',
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              animation: 'chatFadeIn 0.2s ease',
            }}
          >
            <span className="spinner" style={{ width: '14px', height: '14px' }} />
            <span>Navigating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ───────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          padding: '10px 12px',
        }}
      >
        {/* Navigation chips */}
        {messages.length <= 1 && (
          <div style={{ marginBottom: '8px' }}>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginBottom: '4px',
                letterSpacing: '0.5px',
              }}
            >
              SUGGESTED
            </div>
            <NavigationChips onSelect={handleChipSelect} compact />
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Type a command or ask to navigate...'}
            disabled={isProcessing}
            aria-label="Navigation command input"
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-hover)',
              border: `1px solid ${isListening ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'var(--transition)',
              minWidth: 0,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--cyan-dim)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = isListening ? 'var(--red)' : 'var(--border)';
            }}
          />
          <VoiceInput
            isListening={isListening}
            isSupported={isVoiceSupported}
            onStart={startListening}
            onStop={stopListening}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            aria-label="Send command"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: inputValue.trim() && !isProcessing
                ? 'var(--cyan)'
                : 'var(--bg-hover)',
              color: inputValue.trim() && !isProcessing
                ? 'var(--bg-base)'
                : 'var(--text-muted)',
              cursor: inputValue.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              transition: 'var(--transition)',
              opacity: inputValue.trim() && !isProcessing ? 1 : 0.5,
            }}
          >
            ➤
          </button>
        </form>

        {/* Footer hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px',
            fontSize: '9px',
            color: 'var(--text-muted)',
            opacity: 0.6,
          }}
        >
          <span>Type "help" for all commands</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
