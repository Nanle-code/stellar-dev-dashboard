import React, { useMemo, useState } from 'react';
import { ArrowRight, Download, Sparkles, Send } from 'lucide-react';
import {
  buildConversationResponse,
  type SearchIntent,
} from '../../lib/nlpSearchEngine';

interface ConversationalAIInterfaceProps {
  onSubmit: (query: string, parsed: ReturnType<typeof import('../../lib/nlpSearchEngine').parseNaturalLanguageQuery>, intent: SearchIntent | null) => void;
  placeholder?: string;
  isBusy?: boolean;
  resultsSummary?: string;
  onExport?: () => void;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: SearchIntent | null;
  suggestions?: string[];
  followUps?: string[];
};

export default function ConversationalAIInterface({
  onSubmit,
  placeholder = 'Ask for payments, accounts, contracts, or operations…',
  isBusy = false,
  resultsSummary,
  onExport,
}: ConversationalAIInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'I can help you explore Stellar data with natural language. Try “show me payments over 1000 XLM last month” or “find accounts that interact with contract X”.',
      suggestions: [
        'Show me payments over 1000 XLM last month',
        'Find accounts that interact with contract X',
        'List failed transactions from last week',
      ],
    },
  ]);
  const [activeIntent, setActiveIntent] = useState<SearchIntent | null>(null);

  const latestAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === 'assistant');
  }, [messages]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const response = buildConversationResponse(trimmed, activeIntent, { total: 0 });
    const nextMessages: Message[] = [
      ...messages,
      { id: `${Date.now()}-user`, role: 'user', content: trimmed, intent: response.parsed.intent },
      {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: response.summary,
        intent: response.parsed.intent,
        suggestions: response.suggestions,
        followUps: response.followUpQuestions,
      },
    ];

    setMessages(nextMessages);
    setActiveIntent(response.parsed.intent);
    onSubmit(trimmed, response.parsed, response.parsed.intent);
    setInput('');
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan)' }}>
        <Sparkles size={16} />
        <strong style={{ fontSize: '13px' }}>Conversational AI assistant</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: message.role === 'assistant' ? 'var(--bg-elevated)' : 'rgba(6, 182, 212, 0.12)',
              border: message.role === 'assistant' ? '1px solid var(--border)' : '1px solid rgba(6, 182, 212, 0.24)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
              {message.role === 'assistant' ? 'assistant' : 'you'}
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>{message.content}</div>
            {message.intent && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Intent: <strong>{message.intent.type}</strong> • confidence {Math.round(message.intent.confidence * 100)}%
              </div>
            )}
            {message.suggestions && message.suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {message.suggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '999px',
                      padding: '4px 8px',
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {message.followUps && message.followUps.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Try next:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {message.followUps.slice(0, 2).map((followUp) => (
                    <button
                      key={followUp}
                      type="button"
                      onClick={() => setInput(followUp)}
                      style={{
                        border: '1px solid rgba(6, 182, 212, 0.24)',
                        borderRadius: '999px',
                        padding: '4px 8px',
                        background: 'rgba(6, 182, 212, 0.12)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: 'var(--cyan)',
                      }}
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {resultsSummary && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{resultsSummary}</div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={isBusy}
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '10px 12px',
            background: 'var(--cyan)',
            color: 'white',
            cursor: isBusy ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isBusy ? 'Working…' : <><Send size={14} /> Ask</>}
        </button>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {latestAssistantMessage?.intent ? `Last intent: ${latestAssistantMessage.intent.type}` : 'Ask a question to refine the results.'}
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '999px',
              padding: '6px 10px',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <Download size={13} /> Export
          </button>
        )}
      </div>
    </div>
  );
}
