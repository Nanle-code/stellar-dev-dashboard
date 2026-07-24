/**
 * useConversationNavigation — Hook for the conversational navigation system (#555)
 *
 * Manages the dialogue flow: user input → intent classification → clarification → navigation.
 * Integrates with zustand store for tab navigation and react-router for URL updates.
 */

import { useReducer, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import {
  classifyNavigationIntent,
  type NavIntentType,
  type NavigationIntent,
} from '../../lib/navigationClassifier';
import {
  conversationReducer,
  initialState,
  createMessage,
  getNavigationResponse,
  getClarificationPrompt,
  getErrorResponse,
  getConfirmationResponse,
  getVoiceGreeting,
  getCommandHelpText,
  type Message,
} from '../../lib/conversationStore';

export function useConversationNavigation() {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  const navigate = useNavigate();
  const { setActiveTab } = useStore();
  const recognitionRef = useRef<any>(null);
  const stateRef = useRef(state);

  // Keep a ref to latest state for use in callbacks without stale closures
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Navigate to a specific tab ─────────────────────────────────────────────

  const executeNavigation = useCallback(
    (intent: NavigationIntent) => {
      const { type } = intent;

      // Navigate (help is handled inline in processInput)
      if (type === 'help') {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        return;
      }

      // Add assistant message about navigation
      const response = getNavigationResponse(intent);
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('assistant', response, {
          type: 'navigation',
          intent,
        }),
      });

      if (type === 'connect') {
        navigate('/connect');
        setActiveTab('overview');
      } else {
        navigate(`/${type}`);
        setActiveTab(type);
      }

      dispatch({
        type: 'SET_LAST_NAVIGATION',
        payload: { type, timestamp: Date.now() },
      });

      dispatch({ type: 'SET_PROCESSING', payload: false });
    },
    [navigate, setActiveTab]
  );

  // ─── Resolve clarification ──────────────────────────────────────────────────

  const resolveClarification = useCallback(
    (input: string) => {
      const currentState = stateRef.current;
      if (!currentState.pendingClarification) {
        // No clarification pending — treat as new command
        return false;
      }

      const trimmed = input.trim().toLowerCase();
      const { alternatives, originalIntent } = currentState.pendingClarification;

      // Try to match by number
      const numMatch = trimmed.match(/^(\d+)$/);
      if (numMatch) {
        const idx = parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < alternatives.length) {
          const chosen = alternatives[idx];
          const confirmedIntent: NavigationIntent = {
            ...originalIntent,
            type: chosen.type,
            confidence: 0.95,
            isAmbiguous: false,
            alternatives: [],
          };
          dispatch({ type: 'RESOLVE_CLARIFICATION', payload: chosen.type });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('assistant', getConfirmationResponse(chosen.type), {
              type: 'confirmation',
            }),
          });
          executeNavigation(confirmedIntent);
          return true;
        }
      }

      // Try to match by name
      const classified = classifyNavigationIntent(trimmed);
      if (classified.confidence >= 0.7 && classified.type !== 'unknown') {
        const match = alternatives.find(a => a.type === classified.type);
        if (match) {
          const confirmedIntent: NavigationIntent = {
            ...originalIntent,
            type: match.type,
            confidence: 0.95,
            isAmbiguous: false,
            alternatives: [],
          };
          dispatch({ type: 'RESOLVE_CLARIFICATION', payload: match.type });
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('assistant', getConfirmationResponse(match.type), {
              type: 'confirmation',
            }),
          });
          executeNavigation(confirmedIntent);
          return true;
        }
      }

      // Still ambiguous — re-ask
      const reaskList = alternatives.map(function(a, i) { return (i + 1) + '. **' + a.label + '**'; }).join('\n');
      const reaskMsg = "Sorry, I didn't catch that. Please choose:\n\n" + reaskList;
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('assistant', reaskMsg, {
          type: 'clarification',
        }),
      });
      dispatch({ type: 'SET_PROCESSING', payload: false });
      return true;
    },
    [executeNavigation]
  );

  // ─── Process user input ─────────────────────────────────────────────────────

  const processInput = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      dispatch({ type: 'SET_PROCESSING', payload: true });

      // Check if there's a pending clarification first (uses ref for fresh state)
      const currentState = stateRef.current;
      if (currentState.pendingClarification && !currentState.pendingClarification.resolved) {
        // Add user message with clarification context
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('user', trimmed),
        });
        resolveClarification(trimmed);
        return;
      }

      // Add user message
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('user', trimmed),
      });

      // Classify intent
      const intent = classifyNavigationIntent(trimmed);

      // Handle high-confidence matches
      if (intent.confidence >= 0.85 && intent.type !== 'unknown') {
        if (intent.type === 'help') {
          const helpText = getCommandHelpText();
          dispatch({
            type: 'ADD_MESSAGE',
            payload: createMessage('assistant', helpText, { type: 'help' }),
          });
          dispatch({ type: 'SET_PROCESSING', payload: false });
          return;
        }
        executeNavigation(intent);
        return;
      }

      // Handle medium-confidence matches — ask clarification
      if (intent.confidence >= 0.6 && intent.type !== 'unknown' && intent.isAmbiguous) {
        const clarificationState = {
          originalIntent: intent,
          alternatives: intent.alternatives,
          askedAt: Date.now(),
          resolved: false,
        };

        dispatch({ type: 'SET_CLARIFICATION', payload: clarificationState });
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('assistant', getClarificationPrompt(intent.alternatives), {
            type: 'clarification',
            intent,
          }),
        });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        return;
      }

      // Handle low-confidence / unknown intents
      const errorResponse = getErrorResponse(trimmed);
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('assistant', errorResponse, { type: 'error' }),
      });
      dispatch({ type: 'SET_PROCESSING', payload: false });
    },
    [executeNavigation, resolveClarification]
  );

  // ─── Voice Input ────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.isListening) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('assistant', 'Voice input is not supported in your browser. Try Chrome or Edge.', {
          type: 'error',
        }),
      });
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    // Track most recent interim result to avoid flooding
    let lastInterimText = '';

    recognition.onresult = (event: any) => {
      // Use the latest result, not just the first alternative
      const resultIndex = event.results.length - 1;
      const transcript = event.results[resultIndex][0].transcript.trim();

      if (event.results[resultIndex].isFinal) {
        dispatch({ type: 'SET_LISTENING', payload: false });
        if (transcript) {
          processInput(transcript);
        }
        lastInterimText = '';
      } else if (transcript !== lastInterimText) {
        // Only update when interim text actually changes (avoids flooding)
        lastInterimText = transcript;
        // Replace the last message if it's an interim voice transcript
        dispatch({
          type: 'ADD_MESSAGE',
          payload: createMessage('user', '🎤 ' + transcript + '...', {
            type: 'voice',
          }),
        });
      }
    };

    recognition.onerror = (event: any) => {
      dispatch({ type: 'SET_LISTENING', payload: false });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: createMessage('assistant', 'Voice input error: ' + event.error + '. Please try typing instead.', {
          type: 'error',
        }),
      });
    };

    recognition.onend = () => {
      dispatch({ type: 'SET_LISTENING', payload: false });
    };

    recognitionRef.current = recognition;
    dispatch({ type: 'SET_LISTENING', payload: true });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: createMessage('assistant', getVoiceGreeting(), { type: 'voice' }),
    });

    recognition.start();
  }, [processInput]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, []);

  // ─── Clear conversation ────────────────────────────────────────────────────

  const clearConversation = useCallback(() => {
    dispatch({ type: 'CLEAR_CONVERSATION' });
  }, []);

  // ─── Send text message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (text: string) => {
      const currentState = stateRef.current;
      if (currentState.isListening) {
        stopListening();
      }
      processInput(text);
    },
    [processInput, stopListening]
  );

  return {
    messages: state.messages,
    isProcessing: state.isProcessing,
    isListening: state.isListening,
    isVoiceSupported: state.isVoiceSupported,
    pendingClarification: state.pendingClarification,
    lastNavigation: state.lastNavigation,
    sendMessage,
    startListening,
    stopListening,
    clearConversation,
  };
}
