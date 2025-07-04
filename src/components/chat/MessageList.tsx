'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageListProps, Message } from '@/types/chat';

export const MessageList = ({ 
  messages, 
  isLoading, 
  onAgentHandoff,
  emptyStateMessage = 'No messages yet. Start a conversation!'
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (if enabled)
  useEffect(() => {
    if (isAutoScrollEnabled && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAutoScrollEnabled]);

  // Handle scroll events to determine if user has scrolled up
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAutoScrollEnabled(isNearBottom);
    setShowScrollToBottom(!isNearBottom && messages.length > 0);
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAutoScrollEnabled(true);
    setShowScrollToBottom(false);
  }, []);

  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleAgentHandoff = useCallback((agentName: string) => {
    onAgentHandoff?.(agentName);
  }, [onAgentHandoff]);

  const renderMessageContent = (message: Message) => {
    // Check if this is an agent handoff message
    if (message.content.includes('transfer_to_')) {
      const agentMatch = message.content.match(/transfer_to_(\w+)/);
      if (agentMatch) {
        const agentName = agentMatch[1];
        return (
          <div className="space-y-2">
            <p>{message.content}</p>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                Transferring to {agentName}...
              </p>
              <button
                onClick={() => handleAgentHandoff(agentName)}
                className="mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Continue with {agentName}
              </button>
            </div>
          </div>
        );
      }
    }

    return message.content;
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-center p-8">
        <div>
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg">{emptyStateMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div 
        ref={listRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-4 space-y-4"
      >
        <ul className="space-y-4" role="list">
          {messages.map((message: Message) => (
            <li 
              key={message.id}
              role="listitem"
              aria-label={`${message.role === 'user' ? 'User' : 'Assistant'} message`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col max-w-[70%]">
                <div
                  data-testid="message-bubble"
                  className={`
                    px-4 py-2 rounded-lg break-words
                    ${message.role === 'user' 
                      ? 'bg-blue-500 text-white ml-auto' 
                      : 'bg-gray-200 text-gray-800 mr-auto'
                    }
                  `}
                >
                  {renderMessageContent(message)}
                </div>
                <div className={`text-xs text-gray-500 mt-1 ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.citations.map((citation) => (
                      <div key={citation.id} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">{citation.source}</span>
                        {citation.page && <span className="ml-1">(Page {citation.page})</span>}
                        <div className="mt-1 text-gray-500">{citation.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        
        {isLoading && (
          <div 
            data-testid="loading-indicator"
            className="flex justify-start"
          >
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg mr-auto">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Assistant is typing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          data-testid="scroll-to-bottom"
          className="absolute bottom-4 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
          aria-label="Scroll to bottom"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
};