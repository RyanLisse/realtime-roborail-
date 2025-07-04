import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatHook } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

interface ChatOptions {
  enableRealtimeSession?: boolean;
  enablePersistence?: boolean;
  maxMessages?: number;
  onAgentHandoff?: (agentName: string) => void;
}

export const useChat = (options: ChatOptions = {}): ChatHook => {
  const {
    enableRealtimeSession = false,
    enablePersistence = true,
    maxMessages = 1000,
    onAgentHandoff
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | undefined>();
  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string>(uuidv4());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation from localStorage on mount
  useEffect(() => {
    if (!enablePersistence) return;
    
    const conversationKey = `chat-conversation-${conversationIdRef.current}`;
    const saved = localStorage.getItem(conversationKey);
    if (saved) {
      try {
        const { messages: savedMessages, sessionId, currentAgent: savedAgent } = JSON.parse(saved);
        setMessages(savedMessages || []);
        sessionIdRef.current = sessionId;
        setCurrentAgent(savedAgent);
      } catch (err) {
        console.warn('Failed to load saved conversation:', err);
      }
    }
  }, [enablePersistence]);

  // Save conversation to localStorage when messages change
  useEffect(() => {
    if (!enablePersistence || messages.length === 0) return;
    
    const conversationKey = `chat-conversation-${conversationIdRef.current}`;
    const conversationData = {
      messages: messages.slice(-maxMessages), // Limit stored messages
      sessionId: sessionIdRef.current,
      currentAgent,
      timestamp: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(conversationKey, JSON.stringify(conversationData));
    } catch (err) {
      console.warn('Failed to save conversation:', err);
      // Clear old conversations if storage is full
      clearOldConversations();
    }
  }, [messages, currentAgent, enablePersistence, maxMessages]);

  const clearOldConversations = useCallback(() => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('chat-conversation-'));
      // Keep only the most recent 5 conversations
      const sortedKeys = keys.sort((a, b) => {
        const aData = JSON.parse(localStorage.getItem(a) || '{}');
        const bData = JSON.parse(localStorage.getItem(b) || '{}');
        return new Date(bData.timestamp || 0).getTime() - new Date(aData.timestamp || 0).getTime();
      });
      
      sortedKeys.slice(5).forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.warn('Failed to clear old conversations:', err);
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      agentName: currentAgent,
    };

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // Trim messages if we exceed the maximum
      return newMessages.length > maxMessages 
        ? newMessages.slice(-maxMessages) 
        : newMessages;
    });
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = enableRealtimeSession ? '/api/chat/realtime' : '/api/chat';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message,
          sessionId: sessionIdRef.current,
          conversationId: conversationIdRef.current,
          currentAgent,
          context: {
            messageHistory: messages.slice(-10) // Send last 10 messages for context
          }
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update session ID if provided
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
      
      // Handle agent handoff
      if (data.agentHandoff) {
        setCurrentAgent(data.agentHandoff);
        onAgentHandoff?.(data.agentHandoff);
      }
      
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        citations: data.citations,
        agentName: data.agentName || currentAgent,
        toolCalls: data.toolCalls,
        metadata: data.metadata,
      };

      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        return newMessages.length > maxMessages 
          ? newMessages.slice(-maxMessages) 
          : newMessages;
      });
      
      setIsConnected(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't show error
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send message: ${errorMessage}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [enableRealtimeSession, currentAgent, messages, maxMessages, onAgentHandoff]);

  const clearMessages = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setMessages([]);
    setError(null);
    setIsLoading(false);
    sessionIdRef.current = null;
    conversationIdRef.current = uuidv4(); // Generate new conversation ID
    
    if (enablePersistence) {
      const conversationKey = `chat-conversation-${conversationIdRef.current}`;
      localStorage.removeItem(conversationKey);
    }
  }, [enablePersistence]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reconnect = useCallback(async () => {
    setError(null);
    setIsConnected(false);
    // Reset session to force new connection
    sessionIdRef.current = null;
    
    // TODO: Implement actual reconnection logic if using realtime session
    if (enableRealtimeSession) {
      // This would integrate with the realtime session hook
      console.log('Reconnecting realtime session...');
    }
    
    setIsConnected(true);
  }, [enableRealtimeSession]);

  const switchAgent = useCallback(async (agentName: string) => {
    setCurrentAgent(agentName);
    onAgentHandoff?.(agentName);
    
    // Add a system message about the agent switch
    const switchMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: `Switched to ${agentName} agent.`,
      timestamp: new Date(),
      agentName,
      metadata: { type: 'agent_switch' }
    };
    
    setMessages(prev => [...prev, switchMessage]);
  }, [onAgentHandoff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    isConnected,
    currentAgent,
    sendMessage,
    clearMessages,
    clearError,
    reconnect,
    switchAgent,
  };
};