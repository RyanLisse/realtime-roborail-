import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageInput } from '@/components/chat/MessageInput';

describe('MessageInput', () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input field and send button', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('should update input value when typing', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    expect(input).toHaveValue('Hello world');
  });

  it('should call onSendMessage when send button is clicked', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('should call onSendMessage when Enter key is pressed', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('should not send message when Shift+Enter is pressed', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should clear input after sending message', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    expect(input).toHaveValue('');
  });

  it('should not send empty messages', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const sendButton = screen.getByTestId('send-button');
    
    fireEvent.click(sendButton);
    
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should not send whitespace-only messages', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(sendButton);
    
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should disable input and button when disabled prop is true', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={true} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should show loading state in send button when disabled', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={true} />);
    
    const sendButton = screen.getByTestId('send-button');
    
    expect(sendButton).toHaveTextContent('Sending...');
  });

  it('should handle multiline input with textarea', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
    
    expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
  });

  it('should auto-resize textarea based on content', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    
    // Mock scrollHeight to test auto-resize
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 100,
      writable: true,
    });
    
    fireEvent.change(textarea, { target: { value: 'A very long message that should cause the textarea to expand' } });
    
    // The component should adjust the height based on scrollHeight
    expect(textarea.style.height).toBe('100px');
  });

  it('should have proper accessibility attributes', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    expect(textarea).toHaveAttribute('aria-label', 'Type your message');
    expect(sendButton).toHaveAttribute('aria-label', 'Send message');
  });

  it('should focus on input when component mounts', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    expect(input).toHaveFocus();
  });

  it('should use custom placeholder text', () => {
    const customPlaceholder = 'Enter your query here...';
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} placeholder={customPlaceholder} />);
    
    expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
  });

  it('should enforce maximum character limit', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} maxLength={10} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(input, { target: { value: 'This is a very long message that exceeds the limit' } });
    
    expect(input).toHaveValue('This is a '); // Should be truncated to 10 characters
  });

  it('should show character count when enabled', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} showCharCount={true} maxLength={100} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    expect(screen.getByText('5 / 100')).toBeInTheDocument();
  });

  it('should show remaining characters warning when near limit', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} showCharCount={true} maxLength={100} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const longMessage = 'A'.repeat(95); // 5 characters remaining
    
    fireEvent.change(input, { target: { value: longMessage } });
    
    expect(screen.getByText('5 characters remaining')).toBeInTheDocument();
  });

  it('should show voice input button when voice is enabled', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} voiceEnabled={true} />);
    
    expect(screen.getByTestId('voice-input-button')).toBeInTheDocument();
  });

  it('should not show voice input button when voice is disabled', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} voiceEnabled={false} />);
    
    expect(screen.queryByTestId('voice-input-button')).not.toBeInTheDocument();
  });

  it('should handle composition events (for IME input)', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    // Should not send message during composition
    expect(mockOnSendMessage).not.toHaveBeenCalled();
    
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    // Should send message after composition ends
    expect(mockOnSendMessage).toHaveBeenCalledWith('こんにちは');
  });

  it('should call onTyping callback when typing starts and stops', async () => {
    const onTyping = vi.fn();
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} onTyping={onTyping} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    expect(onTyping).toHaveBeenCalledWith(true);
    
    // Wait for typing timeout
    await waitFor(() => {
      expect(onTyping).toHaveBeenCalledWith(false);
    }, { timeout: 2000 });
  });

  it('should show different border color when near character limit', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} maxLength={100} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const nearLimitMessage = 'A'.repeat(95); // Near limit
    
    fireEvent.change(input, { target: { value: nearLimitMessage } });
    
    expect(input).toHaveClass('border-yellow-400');
    
    const atLimitMessage = 'A'.repeat(98); // Very close to limit
    fireEvent.change(input, { target: { value: atLimitMessage } });
    
    expect(input).toHaveClass('border-red-400');
  });

  it('should reset textarea height after sending message', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={false} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');
    
    // Simulate multi-line content
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
    
    // Mock the style changes
    textarea.style.height = '120px';
    
    fireEvent.click(sendButton);
    
    expect(textarea.style.height).toBe('auto');
  });
});