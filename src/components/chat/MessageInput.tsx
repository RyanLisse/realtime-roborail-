'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageInputProps } from '@/types/chat';

export const MessageInput = ({ 
  onSendMessage, 
  disabled,
  placeholder = 'Type your message...',
  maxLength = 4000,
  showCharCount = true,
  onTyping,
  voiceEnabled = false
}: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Handle typing indicator
  useEffect(() => {
    if (onTyping && message.length > 0 && !disabled) {
      onTyping(true);
      
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      const timeout = setTimeout(() => {
        onTyping(false);
      }, 1000);
      
      setTypingTimeout(timeout);
    }
    
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [message, onTyping, disabled]);

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled && !isComposing) {
      onSendMessage(trimmedMessage);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      // Clear typing indicator
      if (onTyping) {
        onTyping(false);
      }
    }
  }, [message, disabled, isComposing, onSendMessage, onTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Enforce max length
    if (newValue.length <= maxLength) {
      setMessage(newValue);
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleVoiceInput = useCallback(() => {
    // For now, this is a placeholder. In a real implementation,
    // this would integrate with voice recording hooks
    if (typeof onTyping === 'function') {
      onTyping(true);
      
      // Simulate voice input process
      setTimeout(() => {
        const simulatedTranscription = 'Voice input detected...';
        setMessage(prev => prev + (prev ? ' ' : '') + simulatedTranscription);
        onTyping(false);
      }, 1000);
    }
  }, [onTyping]);

  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars < 100;
  const canSend = message.trim().length > 0 && !disabled && !isComposing;

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Character count and status */}
      {showCharCount && (isFocused || isNearLimit) && (
        <div className="px-4 pt-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {message.length > 0 && (
                <span className="text-gray-600">
                  {message.length} / {maxLength}
                </span>
              )}
            </span>
            {isNearLimit && (
              <span className={remainingChars < 50 ? 'text-red-500' : 'text-yellow-600'}>
                {remainingChars} characters remaining
              </span>
            )}
          </div>
        </div>
      )}
      
      <div className="flex items-end gap-2 p-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-label="Type your message"
            className={`
              w-full min-h-[40px] max-h-[120px] px-3 py-2 pr-10
              border rounded-lg resize-none 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isFocused ? 'border-blue-300' : 'border-gray-300'}
              ${isNearLimit ? 'border-yellow-400' : ''}
              ${remainingChars < 50 ? 'border-red-400' : ''}
            `}
            rows={1}
          />
          
          {/* Voice input button (if enabled) */}
          {voiceEnabled && (
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={disabled}
              data-testid="voice-input-button"
              className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-blue-500 disabled:opacity-50"
              aria-label="Voice input"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          data-testid="send-button"
          className={`
            px-4 py-2 rounded-lg min-w-[80px] font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            ${canSend 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-200 text-gray-500'
            }
          `}
        >
          {disabled ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sending...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};