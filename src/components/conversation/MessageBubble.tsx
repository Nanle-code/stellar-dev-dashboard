/**
 * MessageBubble — Individual message in the conversational navigation panel (#555)
 */

import React from 'react';
import type { Message } from '../../lib/conversationStore';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isVoice = message.type === 'voice';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
        animation: 'chatFadeIn 0.25s ease both',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser
            ? 'var(--cyan-glow)'
            : 'var(--bg-elevated)',
          border: `1px solid ${
            isUser ? 'var(--cyan-dim)' : 'var(--border)'
          }`,
          color: isUser ? 'var(--cyan)' : 'var(--text-primary)',
          fontSize: '13px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
          boxShadow: isUser
            ? '0 2px 8px rgba(0, 229, 255, 0.1)'
            : 'none',
          position: 'relative',
        }}
      >
        {/* Render content with bold markdown support */}
        {renderContent(message.content)}
      </div>
      <span
        style={{
          fontSize: '9px',
          color: 'var(--text-muted)',
          marginTop: '3px',
          padding: '0 4px',
          opacity: 0.6,
        }}
      >
        {formatTimestamp(message.timestamp)}
        {isVoice && ' 🎤'}
      </span>
    </div>
  );
}

function renderContent(content: string): React.ReactNode {
  // Simple markdown-like rendering for bold text
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--cyan)' }}>{part.slice(2, -2)}</strong>;
    }
    // Handle newlines
    return part.split('\n').map((line, j) => (
      <React.Fragment key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  });
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
