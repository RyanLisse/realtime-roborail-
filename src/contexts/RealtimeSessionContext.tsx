'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, FC, PropsWithChildren } from 'react';
import { useRealtimeSession, RealtimeSessionCallbacks, ConnectOptions } from '@/app/hooks/useRealtimeSession';
import { RealtimeSessionState, RealtimeSessionHook } from '@/types/chat';

interface RealtimeSessionContextValue extends RealtimeSessionHook {
  isInitialized: boolean;
  connectionOptions: ConnectOptions | null;
  setConnectionOptions: (options: ConnectOptions) => void;
}

const RealtimeSessionContext = createContext<RealtimeSessionContextValue | undefined>(undefined);

export interface RealtimeSessionProviderProps extends PropsWithChildren {
  onAgentHandoff?: (agentName: string) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
}

export const RealtimeSessionProvider: FC<RealtimeSessionProviderProps> = ({ 
  children, 
  onAgentHandoff,
  onError,
  autoReconnect = true 
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionOptions, setConnectionOptions] = useState<ConnectOptions | null>(null);
  const [sessionState, setSessionState] = useState<RealtimeSessionState>({
    status: 'DISCONNECTED',
    isVoiceEnabled: false,
  });

  const callbacks: RealtimeSessionCallbacks = {
    onConnectionChange: (status) => {
      setSessionState(prev => ({ ...prev, status }));
    },
    onAgentHandoff: (agentName) => {
      setSessionState(prev => ({ ...prev, currentAgent: agentName }));
      onAgentHandoff?.(agentName);
    },
    onError: (error) => {
      setSessionState(prev => ({ ...prev, error: error.message, status: 'ERROR' }));
      onError?.(error);
    },
    onReconnect: () => {
      setSessionState(prev => ({ ...prev, error: undefined }));
    },
  };

  const realtimeSession = useRealtimeSession(callbacks);

  // Auto-reconnect logic
  useEffect(() => {
    if (autoReconnect && 
        sessionState.status === 'ERROR' && 
        connectionOptions && 
        realtimeSession.retryCount < 3) {
      const timeout = setTimeout(() => {
        console.log('Auto-reconnecting...');
        realtimeSession.connect(connectionOptions);
      }, Math.pow(2, realtimeSession.retryCount) * 1000); // Exponential backoff

      return () => clearTimeout(timeout);
    }
  }, [sessionState.status, connectionOptions, autoReconnect, realtimeSession]);

  const connect = useCallback(async (options: ConnectOptions) => {
    setConnectionOptions(options);
    await realtimeSession.connect(options);
    setIsInitialized(true);
  }, [realtimeSession]);

  const disconnect = useCallback(() => {
    realtimeSession.disconnect();
    setConnectionOptions(null);
    setIsInitialized(false);
  }, [realtimeSession]);

  const reconnect = useCallback(async () => {
    if (connectionOptions) {
      await realtimeSession.reconnect();
    } else {
      throw new Error('No connection options available for reconnect');
    }
  }, [realtimeSession, connectionOptions]);

  const switchAgent = useCallback(async (agentName: string) => {
    await realtimeSession.switchAgent(agentName);
  }, [realtimeSession]);

  const toggleVoice = useCallback(() => {
    const newVoiceState = !sessionState.isVoiceEnabled;
    setSessionState(prev => ({ ...prev, isVoiceEnabled: newVoiceState }));
    realtimeSession.mute(!newVoiceState);
  }, [sessionState.isVoiceEnabled, realtimeSession]);

  const mute = useCallback((muted: boolean) => {
    realtimeSession.mute(muted);
    setSessionState(prev => ({ ...prev, isVoiceEnabled: !muted }));
  }, [realtimeSession]);

  const sendMessage = useCallback((message: string) => {
    realtimeSession.sendUserText(message);
  }, [realtimeSession]);

  const value: RealtimeSessionContextValue = {
    sessionState,
    isInitialized,
    connectionOptions,
    setConnectionOptions,
    connect,
    disconnect,
    reconnect,
    switchAgent,
    toggleVoice,
    mute,
    sendMessage,
  };

  return (
    <RealtimeSessionContext.Provider value={value}>
      {children}
    </RealtimeSessionContext.Provider>
  );
};

export function useRealtimeSessionContext() {
  const context = useContext(RealtimeSessionContext);
  if (!context) {
    throw new Error('useRealtimeSessionContext must be used within a RealtimeSessionProvider');
  }
  return context;
}

// Hook for optional usage (doesn't throw if not in provider)
export function useOptionalRealtimeSession() {
  return useContext(RealtimeSessionContext);
}