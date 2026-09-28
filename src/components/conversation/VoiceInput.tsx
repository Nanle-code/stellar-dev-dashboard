/**
 * VoiceInput — Microphone button for voice navigation commands (#555)
 * Uses Web Speech API for speech recognition.
 */

import React from 'react';

interface VoiceInputProps {
  isListening: boolean;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function VoiceInput({ isListening, isSupported, onStart, onStop }: VoiceInputProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        title="Voice input not supported in this browser"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-muted)',
          cursor: 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          opacity: 0.4,
          flexShrink: 0,
        }}
      >
        🎤
      </button>
    );
  }

  return (
    <button
      onClick={isListening ? onStop : onStart}
      title={isListening ? 'Stop listening' : 'Start voice input'}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: `2px solid ${isListening ? 'var(--red)' : 'var(--border)'}`,
        background: isListening ? 'var(--red-glow)' : 'var(--bg-elevated)',
        color: isListening ? 'var(--red)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        flexShrink: 0,
        transition: 'all 180ms ease',
        position: 'relative',
        animation: isListening ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isListening) {
          e.currentTarget.style.borderColor = 'var(--cyan-dim)';
          e.currentTarget.style.background = 'var(--cyan-glow)';
          e.currentTarget.style.color = 'var(--cyan)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isListening) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {isListening ? (
        <>
          <span style={{ position: 'relative', zIndex: 1 }}>🎤</span>
          <span
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--red)',
              animation: 'voiceSpin 1s linear infinite',
            }}
          />
        </>
      ) : (
        '🎤'
      )}
      {isListening && (
        <span
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: 'var(--red)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '8px',
            fontWeight: 700,
            padding: '1px 5px',
            letterSpacing: '0.5px',
            animation: 'chatFadeIn 0.3s ease',
          }}
        >
          LIVE
        </span>
      )}
    </button>
  );
}
