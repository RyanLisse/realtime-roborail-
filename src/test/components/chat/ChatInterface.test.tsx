import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInterface } from '@/components/chat/ChatInterface';

// Mock the useChat hook
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

// Mock child components
vi.mock('@/components/chat/MessageList', () => ({
  MessageList: ({ messages, isLoading }: any) => (
    <div data-testid="message-list">
      {messages.map((msg: any) => (
        <div key={msg.id} data-testid={`message-${msg.role}`}>
          {msg.content}
        </div>
      ))}
      {isLoading && <div data-testid="loading">Loading...</div>}
    </div>
  ),
}));

vi.mock('@/components/chat/MessageInput', () => ({
  MessageInput: ({ onSendMessage, disabled }: any) => (
    <div data-testid="message-input">
      <input
        data-testid="input-field"
        disabled={disabled}
        onChange={(e) => {
          // Mock input change
        }}
      />
      <button
        data-testid="send-button"
        disabled={disabled}
        onClick={() => onSendMessage('test message')}
      >
        Send
      </button>
    </div>
  ),
}));

import { useChat } from '@/hooks/useChat';
const mockUseChat = vi.mocked(useChat);

describe('ChatInterface', () => {
  const mockChatHook = {
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue(mockChatHook);
  });

  it('should render MessageList and MessageInput components', () => {
    render(<ChatInterface />);
    
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('should pass messages and loading state to MessageList', () => {
    const messages = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Hi there', timestamp: new Date() },
    ];

    mockUseChat.mockReturnValue({
      ...mockChatHook,
      messages,
      isLoading: true,
    });

    render(<ChatInterface />);
    
    expect(screen.getByTestId('message-user')).toHaveTextContent('Hello');
    expect(screen.getByTestId('message-assistant')).toHaveTextContent('Hi there');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should handle message sending from MessageInput', async () => {
    const mockSendMessage = vi.fn();
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      sendMessage: mockSendMessage,
    });

    render(<ChatInterface />);
    
    fireEvent.click(screen.getByTestId('send-button'));
    
    expect(mockSendMessage).toHaveBeenCalledWith('test message');
  });

  it('should disable input when loading', () => {
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      isLoading: true,
    });

    render(<ChatInterface />);
    
    expect(screen.getByTestId('input-field')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('should display error message when error exists', () => {
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      error: 'Something went wrong',
    });

    render(<ChatInterface />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should clear error when dismiss button is clicked', () => {
    const mockClearError = vi.fn();
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      error: 'Something went wrong',
      clearError: mockClearError,
    });

    render(<ChatInterface />);
    
    fireEvent.click(screen.getByTestId('dismiss-error'));
    
    expect(mockClearError).toHaveBeenCalled();
  });

  it('should have a clear messages button', () => {
    const mockClearMessages = vi.fn();
    mockUseChat.mockReturnValue({
      ...mockChatHook,
      messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
      clearMessages: mockClearMessages,
    });

    render(<ChatInterface />);
    
    const clearButton = screen.getByTestId('clear-messages');
    fireEvent.click(clearButton);
    
    expect(mockClearMessages).toHaveBeenCalled();
  });
});