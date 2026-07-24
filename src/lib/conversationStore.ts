/**
 * Conversation Store — State management for the conversational navigation dialogue system (#555)
 *
 * Manages conversation history, context tracking for follow-up intents,
 * and ambiguous request resolution through clarifying questions.
 */

import type { NavigationIntent, NavIntentType, NavCommand } from './navigationClassifier';
import { NAV_COMMANDS } from './navigationClassifier';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  intent?: NavigationIntent;
  type?: 'navigation' | 'clarification' | 'confirmation' | 'error' | 'help' | 'info' | 'voice';
}

export interface ConversationState {
  messages: Message[];
  isProcessing: boolean;
  isVoiceSupported: boolean;
  isListening: boolean;
  pendingClarification: ClarificationState | null;
  lastNavigation: { type: NavIntentType; timestamp: number } | null;
}

export interface ClarificationState {
  originalIntent: NavigationIntent;
  alternatives: Array<{ type: NavIntentType; confidence: number; label: string }>;
  askedAt: number;
  resolved: boolean;
}

export type ConversationAction =
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_VOICE_SUPPORT'; payload: boolean }
  | { type: 'SET_CLARIFICATION'; payload: ClarificationState | null }
  | { type: 'RESOLVE_CLARIFICATION'; payload: NavIntentType }
  | { type: 'CLEAR_CONVERSATION' }
  | { type: 'SET_LAST_NAVIGATION'; payload: { type: NavIntentType; timestamp: number } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

let messageCounter = 0;

function generateId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

export function createMessage(
  role: MessageRole,
  content: string,
  overrides: Partial<Message> = {}
): Message {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Dialogue Responses ───────────────────────────────────────────────────────

export function getNavigationResponse(intent: NavigationIntent): string {
  const command = NAV_COMMANDS.find(c => c.id === intent.type);
  if (!command) return `Navigating to ${intent.type}...`;

  return `🔄 Taking you to **${command.label}**…`;
}

export function getClarificationPrompt(alternatives: Array<{ type: NavIntentType; confidence: number; label: string }>): string {
  let text = `🤔 I found a few possible destinations. Which one did you mean?\n\n`;
  alternatives.forEach((alt, i) => {
    text += `${i + 1}. **${alt.label}**\n`;
  });
  text += `\nJust type the name or number of the one you want.`;
  return text;
}

export function getAmbiguousResponse(intent: NavigationIntent): string {
  const altLabels = intent.alternatives.map(a => `**${a.label}**`).join(', ');
  return `🤔 I'm not quite sure where you want to go. Did you mean one of these?\n\n${altLabels}\n\nOr try rephrasing your request.`;
}

export function getConfirmationResponse(type: NavIntentType): string {
  const command = NAV_COMMANDS.find(c => c.id === type);
  if (!command) return `✅ Got it! Navigating…`;
  return `✅ **${command.label}** it is! Taking you there now.`;
}

export function getErrorResponse(query: string): string {
  return `I couldn't find a destination matching "${query}". Try saying:\n- "Take me to my portfolio"\n- "Show me network stats"\n- "Go to transactions"\n- Type "help" to see all available commands.`;
}

export function getVoiceGreeting(): string {
  return '🎤 Listening... Say a navigation command like "show me my portfolio" or "go to network stats".';
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };

    case 'SET_LISTENING':
      return {
        ...state,
        isListening: action.payload,
      };

    case 'SET_VOICE_SUPPORT':
      return {
        ...state,
        isVoiceSupported: action.payload,
      };

    case 'SET_CLARIFICATION':
      return {
        ...state,
        pendingClarification: action.payload,
      };

    case 'RESOLVE_CLARIFICATION':
      return {
        ...state,
        pendingClarification: state.pendingClarification
          ? { ...state.pendingClarification, resolved: true }
          : null,
      };

    case 'CLEAR_CONVERSATION':
      return {
        ...state,
        messages: [],
        pendingClarification: null,
        lastNavigation: null,
      };

    case 'SET_LAST_NAVIGATION':
      return {
        ...state,
        lastNavigation: action.payload,
      };

    default:
      return state;
  }
}

// ─── Initial State ────────────────────────────────────────────────────────────

export const initialState: ConversationState = {
  messages: [
    createMessage('assistant', '👋 Hey! I can navigate you anywhere on the dashboard. Try saying:\n\n• *"Show me my portfolio"*\n• *"Go to network stats"*\n• *"Take me to transactions"*\n\nOr type **help** to see all available commands.', {
      type: 'info',
    }),
  ],
  isProcessing: false,
  isVoiceSupported: typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  isListening: false,
  pendingClarification: null,
  lastNavigation: null,
};
