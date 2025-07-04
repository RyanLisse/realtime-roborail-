import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageList } from '@/components/chat/MessageList';
import { Message } from '@/types/chat';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date('2023-01-01T10:00:00Z'),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I am doing well, thank you for asking!',
      timestamp: new Date('2023-01-01T10:01:00Z'),
    },
    {
      id: '3',
      role: 'user',
      content: 'That is great to hear.',
      timestamp: new Date('2023-01-01T10:02:00Z'),
    },
  ];

  it('should render empty state when no messages', () => {
    render(<MessageList messages={[]} isLoading={false} />);
    
    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('should render all messages', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('I am doing well, thank you for asking!')).toBeInTheDocument();
    expect(screen.getByText('That is great to hear.')).toBeInTheDocument();
  });

  it('should apply correct styling to user messages', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    const userMessage = screen.getByText('Hello, how are you?').closest('[data-testid="message-bubble"]');
    expect(userMessage).toHaveClass('bg-blue-500', 'text-white', 'ml-auto');
  });

  it('should apply correct styling to assistant messages', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    const assistantMessage = screen.getByText('I am doing well, thank you for asking!').closest('[data-testid="message-bubble"]');
    expect(assistantMessage).toHaveClass('bg-gray-200', 'text-gray-800', 'mr-auto');
  });

  it('should display timestamps', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    // Timestamps are formatted according to local time
    expect(screen.getByText('11:00 AM')).toBeInTheDocument();
    expect(screen.getByText('11:01 AM')).toBeInTheDocument();
    expect(screen.getByText('11:02 AM')).toBeInTheDocument();
  });

  it('should show loading indicator when isLoading is true', () => {
    render(<MessageList messages={mockMessages} isLoading={true} />);
    
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText('Assistant is typing...')).toBeInTheDocument();
  });

  it('should auto-scroll to bottom when new messages are added', () => {
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const { rerender } = render(<MessageList messages={mockMessages.slice(0, 2)} isLoading={false} />);
    
    rerender(<MessageList messages={mockMessages} isLoading={false} />);
    
    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  it('should handle long messages with proper word wrapping', () => {
    const longMessage: Message = {
      id: '4',
      role: 'assistant',
      content: 'This is a very long message that should wrap properly within the message bubble and not overflow the container boundaries.',
      timestamp: new Date(),
    };

    render(<MessageList messages={[longMessage]} isLoading={false} />);
    
    const messageElement = screen.getByText(longMessage.content).closest('[data-testid="message-bubble"]');
    expect(messageElement).toHaveClass('break-words');
  });

  it('should display role labels for accessibility', () => {
    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    const messages = screen.getAllByRole('listitem');
    expect(messages[0]).toHaveAttribute('aria-label', 'User message');
    expect(messages[1]).toHaveAttribute('aria-label', 'Assistant message');
  });

  it('should render citations when present', () => {
    const messageWithCitations: Message = {
      id: '5',
      role: 'assistant',
      content: 'Here is some information with citations.',
      timestamp: new Date(),
      citations: [
        {
          id: 'c1',
          text: 'Citation text here',
          source: 'Source Document',
          confidence: 0.9,
          page: 42,
        },
      ],
    };

    render(<MessageList messages={[messageWithCitations]} isLoading={false} />);
    
    expect(screen.getByText('Source Document')).toBeInTheDocument();
    expect(screen.getByText('(Page 42)')).toBeInTheDocument();
    expect(screen.getByText('Citation text here')).toBeInTheDocument();
  });

  it('should handle agent handoff messages', () => {
    const onAgentHandoff = vi.fn();
    const handoffMessage: Message = {
      id: '6',
      role: 'assistant',
      content: 'I will transfer_to_sales_agent for further assistance.',
      timestamp: new Date(),
    };

    render(<MessageList messages={[handoffMessage]} isLoading={false} onAgentHandoff={onAgentHandoff} />);
    
    expect(screen.getByText('Transferring to sales_agent...')).toBeInTheDocument();
    
    const continueButton = screen.getByText('Continue with sales_agent');
    continueButton.click();
    
    expect(onAgentHandoff).toHaveBeenCalledWith('sales_agent');
  });

  it('should show scroll to bottom button when not at bottom', () => {
    // Mock scroll properties
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 400,
    });

    render(<MessageList messages={mockMessages} isLoading={false} />);
    
    // Simulate scroll event
    const scrollableElement = screen.getByRole('list').parentElement;
    if (scrollableElement) {
      scrollableElement.dispatchEvent(new Event('scroll'));
    }
    
    expect(screen.getByTestId('scroll-to-bottom')).toBeInTheDocument();
  });

  it('should use custom empty state message', () => {
    const customMessage = 'Start chatting now!';
    render(<MessageList messages={[]} isLoading={false} emptyStateMessage={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('should handle messages with metadata', () => {
    const messageWithMetadata: Message = {
      id: '7',
      role: 'assistant',
      content: 'Switched to customer service agent.',
      timestamp: new Date(),
      agentName: 'CustomerService',
      metadata: { type: 'agent_switch' },
    };

    render(<MessageList messages={[messageWithMetadata]} isLoading={false} />);
    
    expect(screen.getByText('Switched to customer service agent.')).toBeInTheDocument();
  });
});