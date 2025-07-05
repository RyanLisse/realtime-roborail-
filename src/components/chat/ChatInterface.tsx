'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatInterfaceProps } from '@/types/chat';

export const ChatInterface = ({ 
  className = '', 
  title = 'Chat',
  onAgentHandoff,
  agentName 
}: ChatInterfaceProps) => {
  const { 
    messages, 
    isLoading, 
    error, 
    isConnected,
    currentAgent,
    sendMessage, 
    clearMessages, 
    clearError, 
    reconnect 
  } = useChat({
    enablePersistence: true,
    onAgentHandoff,
  });
  const [retryCount, setRetryCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Track error changes for retry logic
  useEffect(() => {
    if (error !== lastError) {
      setLastError(error);
      if (error) {
        setRetryCount(0);
      }
    }
  }, [error, lastError]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= 3) {
      return; // Max retries reached
    }
    
    setIsConnecting(true);
    setRetryCount(prev => prev + 1);
    
    try {
      await reconnect?.();
      clearError();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [retryCount, reconnect, clearError]);

  const handleSendMessage = useCallback(async (message: string) => {
    try {
      await sendMessage(message);
      setRetryCount(0); // Reset retry count on successful send
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [sendMessage]);

  const isDisabled = isLoading || isConnecting;
  const canRetry = error && retryCount < 3 && !isConnecting;

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          {agentName && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {agentName}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Connection Status */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              isConnecting ? 'bg-yellow-500 animate-pulse' :
              error ? 'bg-red-500' : 
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-600">
              {isConnecting ? 'Connecting...' : 
               error ? 'Error' : 
               isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <button
            onClick={clearMessages}
            disabled={messages.length === 0 || isDisabled}
            data-testid="clear-messages"
            className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">Connection Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              {retryCount > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Retry attempt {retryCount} of 3
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4">
              {canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={isConnecting}
                  data-testid="retry-connection"
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {isConnecting ? 'Retrying...' : 'Retry'}
                </button>
              )}
              <button
                onClick={clearError}
                data-testid="dismiss-error"
                className="text-red-500 hover:text-red-700 focus:outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <MessageList 
        messages={messages} 
        isLoading={isLoading}
        onAgentHandoff={onAgentHandoff}
      />

      {/* Input */}
      <MessageInput 
        onSendMessage={handleSendMessage} 
        disabled={isDisabled}
        placeholder={isConnecting ? 'Connecting...' : 'Type your message...'}
      />
    </div>
  );
};