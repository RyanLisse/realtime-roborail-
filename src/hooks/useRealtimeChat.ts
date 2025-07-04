import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from './useChat';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { useOptionalRealtimeSession } from '@/contexts/RealtimeSessionContext';
import { Message } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

export interface RealtimeChatOptions {
  enableFallback?: boolean; // Fall back to regular chat if realtime fails
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onAgentHandoff?: (agentName: string) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (status: string) => void;
}

export interface RealtimeChatReturn {
  // Chat functionality
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  
  // Realtime functionality
  isRealtimeActive: boolean;
  realtimeStatus: string;
  toggleRealtime: () => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  
  // Voice controls
  isMuted: boolean;
  toggleMute: () => void;
  interrupt: () => void;
  
  // Agent management
  currentAgent?: string;
  switchAgent: (agentName: string) => Promise<void>;
  
  // Session management
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

export function useRealtimeChat(options: RealtimeChatOptions = {}): RealtimeChatReturn {
  const {
    enableFallback = true,
    autoReconnect = true,
    maxReconnectAttempts = 3,
    onAgentHandoff,
    onError,
    onConnectionChange,
  } = options;

  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const reconnectAttempts = useRef(0);
  const isInitialized = useRef(false);

  // Regular chat hook (fallback)
  const chat = useChat({
    enableRealtimeSession: false,
    onAgentHandoff,
  });

  // Realtime session context (optional)
  const realtimeContext = useOptionalRealtimeSession();

  // Direct realtime session hook
  const realtimeSession = useRealtimeSession({
    onConnectionChange: (status) => {
      onConnectionChange?.(status);
      
      if (status === 'CONNECTED') {
        setIsRealtimeActive(true);
        reconnectAttempts.current = 0;
        
        // Send any pending messages
        if (pendingMessages.length > 0) {
          pendingMessages.forEach(message => {
            realtimeSession.sendUserText(message);
          });
          setPendingMessages([]);
        }
      } else if (status === 'DISCONNECTED' || status === 'ERROR') {
        setIsRealtimeActive(false);
        
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++;
            reconnect();
          }, Math.pow(2, reconnectAttempts.current) * 1000);
        }
      }
    },
    onAgentHandoff: (agentName) => {
      onAgentHandoff?.(agentName);
    },
    onError: (error) => {
      onError?.(error);
      
      if (enableFallback && !isInitialized.current) {
        console.warn('Realtime session failed, falling back to regular chat');
      }
    },
    onMessage: (message) => {
      // Convert realtime message to chat message format
      const chatMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: message.content || message.text || '',
        timestamp: new Date(),
        agentName: realtimeSession.currentAgent || undefined,
        metadata: { source: 'realtime', ...message.metadata },
      };
      
      setRealtimeMessages(prev => [...prev, chatMessage]);
    },
  });

  // Initialize realtime session if context is available
  useEffect(() => {
    if (realtimeContext && !isInitialized.current) {
      isInitialized.current = true;
      setIsRealtimeActive(realtimeContext.sessionState.status === 'CONNECTED');
    }
  }, [realtimeContext]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Add user message to display immediately
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    if (isRealtimeActive && realtimeSession.status === 'CONNECTED') {
      // Send via realtime session
      setRealtimeMessages(prev => [...prev, userMessage]);
      try {
        realtimeSession.sendUserText(message);
      } catch (error) {
        console.error('Failed to send realtime message:', error);
        
        if (enableFallback) {
          // Fall back to regular chat
          await chat.sendMessage(message);
        } else {
          throw error;
        }
      }
    } else if (isRealtimeActive && realtimeSession.status !== 'CONNECTED') {
      // Queue message for when connection is restored
      setPendingMessages(prev => [...prev, message]);
      setRealtimeMessages(prev => [...prev, userMessage]);
    } else {
      // Use regular chat
      await chat.sendMessage(message);
    }
  }, [isRealtimeActive, realtimeSession, chat, enableFallback]);

  const sendVoiceMessage = useCallback(async (audioBlob: Blob) => {
    if (!isRealtimeActive || realtimeSession.status !== 'CONNECTED') {
      throw new Error('Realtime session not active');
    }

    // Convert audio to the format expected by the realtime API
    try {
      const audioBuffer = await audioBlob.arrayBuffer();
      
      // Send audio event to realtime session
      realtimeSession.sendEvent({
        type: 'input_audio_buffer.append',
        audio: new Uint8Array(audioBuffer),
      });
      
      realtimeSession.sendEvent({
        type: 'input_audio_buffer.commit',
      });
      
      realtimeSession.sendEvent({
        type: 'response.create',
      });
    } catch (error) {
      console.error('Failed to send voice message:', error);
      throw error;
    }
  }, [isRealtimeActive, realtimeSession]);

  const toggleRealtime = useCallback(async () => {
    if (isRealtimeActive) {
      // Disconnect realtime
      realtimeSession.disconnect();
      if (realtimeContext) {
        realtimeContext.disconnect();
      }
      setIsRealtimeActive(false);
    } else {
      // Connect realtime
      try {
        if (realtimeContext) {
          if (!realtimeContext.connectionOptions) {
            throw new Error('No realtime connection options available');
          }
          await realtimeContext.connect(realtimeContext.connectionOptions);
        } else {
          // Need connection options - this should be provided by the consumer
          throw new Error('No realtime session context available');
        }
      } catch (error) {
        console.error('Failed to enable realtime:', error);
        onError?.(error as Error);
        
        if (!enableFallback) {
          throw error;
        }
      }
    }
  }, [isRealtimeActive, realtimeSession, realtimeContext, enableFallback, onError]);

  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (isRealtimeActive) {
      realtimeSession.mute(newMutedState);
    }
    
    if (realtimeContext) {
      realtimeContext.mute(newMutedState);
    }
  }, [isMuted, isRealtimeActive, realtimeSession, realtimeContext]);

  const interrupt = useCallback(() => {
    if (isRealtimeActive && realtimeSession.status === 'CONNECTED') {
      realtimeSession.interrupt();
    }
  }, [isRealtimeActive, realtimeSession]);

  const switchAgent = useCallback(async (agentName: string) => {
    if (isRealtimeActive) {
      await realtimeSession.switchAgent(agentName);
    } else {
      await chat.switchAgent?.(agentName);
    }
  }, [isRealtimeActive, realtimeSession, chat]);

  const reconnect = useCallback(async () => {
    if (isRealtimeActive) {
      try {
        if (realtimeContext) {
          await realtimeContext.reconnect();
        } else {
          await realtimeSession.reconnect();
        }
      } catch (error) {
        console.error('Failed to reconnect:', error);
        onError?.(error as Error);
      }
    } else {
      await chat.reconnect?.();
    }
  }, [isRealtimeActive, realtimeContext, realtimeSession, chat, onError]);

  const disconnect = useCallback(() => {
    if (isRealtimeActive) {
      realtimeSession.disconnect();
      if (realtimeContext) {
        realtimeContext.disconnect();
      }
    }
    setIsRealtimeActive(false);
  }, [isRealtimeActive, realtimeSession, realtimeContext]);

  const clearMessages = useCallback(() => {
    if (isRealtimeActive) {
      setRealtimeMessages([]);
    } else {
      chat.clearMessages();
    }
    setPendingMessages([]);
  }, [isRealtimeActive, chat]);

  const clearError = useCallback(() => {
    chat.clearError();
  }, [chat]);

  // Determine which messages to show
  const messages = isRealtimeActive ? realtimeMessages : chat.messages;
  const error = chat.error; // Errors from both systems
  const isLoading = chat.isLoading || (isRealtimeActive && pendingMessages.length > 0);
  const currentAgent = isRealtimeActive ? 
    (realtimeSession.currentAgent || realtimeContext?.sessionState.currentAgent) : 
    chat.currentAgent;

  return {
    // Chat functionality
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
    
    // Realtime functionality
    isRealtimeActive,
    realtimeStatus: realtimeContext?.sessionState.status || realtimeSession.status,
    toggleRealtime,
    sendVoiceMessage,
    
    // Voice controls
    isMuted,
    toggleMute,
    interrupt,
    
    // Agent management
    currentAgent,
    switchAgent,
    
    // Session management
    reconnect,
    disconnect,
  };
}
