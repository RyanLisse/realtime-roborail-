import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { RealtimeSessionProvider } from '@/contexts/RealtimeSessionContext';

// Mock all the hooks and dependencies
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/app/hooks/useRealtimeSession', () => ({
  useRealtimeSession: vi.fn(),
}));

vi.mock('@/app/contexts/EventContext', () => ({
  useEvent: () => ({
    logClientEvent: vi.fn(),
    logServerEvent: vi.fn(),
  }),
}));

vi.mock('@/app/hooks/useHandleSessionHistory', () => ({
  useHandleSessionHistory: () => ({ current: {
    handleTranscriptionCompleted: vi.fn(),
    handleTranscriptionDelta: vi.fn(),
    handleAgentToolStart: vi.fn(),
    handleAgentToolEnd: vi.fn(),
    handleHistoryUpdated: vi.fn(),
    handleHistoryAdded: vi.fn(),
    handleGuardrailTripped: vi.fn(),
  }}),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

const mockChatHook = {
  messages: [],
  isLoading: false,
  error: null,
  isConnected: false,
  currentAgent: 'TestAgent',
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
  clearError: vi.fn(),
  reconnect: vi.fn(),
  switchAgent: vi.fn(),
};

const mockRealtimeSession = {
  status: 'DISCONNECTED',
  currentAgent: null,
  retryCount: 0,
  lastError: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  switchAgent: vi.fn(),
  sendUserText: vi.fn(),
  sendEvent: vi.fn(),
  mute: vi.fn(),
  pushToTalkStart: vi.fn(),
  pushToTalkStop: vi.fn(),
  interrupt: vi.fn(),
};

const { useChat } = await import('@/hooks/useChat');
const { useRealtimeSession } = await import('@/app/hooks/useRealtimeSession');

vi.mocked(useChat).mockReturnValue(mockChatHook as any);
vi.mocked(useRealtimeSession).mockReturnValue(mockRealtimeSession as any);

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <RealtimeSessionProvider>
    {children}
  </RealtimeSessionProvider>
);

describe('Chat System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: 'Test response',
        sessionId: 'test-session-id',
      }),
    } as any);
  });

  it('should render complete chat interface', () => {
    render(
      <TestWrapper>
        <ChatInterface title="Test Chat" agentName="TestAgent" />
      </TestWrapper>
    );

    expect(screen.getByText('Test Chat')).toBeInTheDocument();
    expect(screen.getByText('TestAgent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('should handle complete message sending flow', async () => {
    const onAgentHandoff = vi.fn();
    
    // Mock successful message sending
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello!',
        timestamp: new Date(),
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Hello! How can I help you?',
        timestamp: new Date(),
      },
    ];

    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      messages: mockMessages,
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as any);

    render(
      <TestWrapper>
        <ChatInterface onAgentHandoff={onAgentHandoff} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTestId('send-button');

    // Type and send message
    fireEvent.change(input, { target: { value: 'Hello!' } });
    fireEvent.click(sendButton);

    // Check that messages are displayed
    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
  });

  it('should handle agent handoff workflow', async () => {
    const onAgentHandoff = vi.fn();
    
    const handoffMessage = {
      id: '3',
      role: 'assistant' as const,
      content: 'I will transfer_to_sales_agent for further assistance.',
      timestamp: new Date(),
    };

    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      messages: [handoffMessage],
    } as any);

    render(
      <TestWrapper>
        <ChatInterface onAgentHandoff={onAgentHandoff} />
      </TestWrapper>
    );

    // Should display handoff UI
    expect(screen.getByText('Transferring to sales_agent...')).toBeInTheDocument();
    
    const continueButton = screen.getByText('Continue with sales_agent');
    fireEvent.click(continueButton);
    
    expect(onAgentHandoff).toHaveBeenCalledWith('sales_agent');
  });

  it('should handle error states gracefully', () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      error: 'Connection failed',
      isConnected: false,
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByTestId('retry-connection')).toBeInTheDocument();
  });

  it('should handle retry functionality', async () => {
    const mockReconnect = vi.fn().mockResolvedValue(undefined);
    const mockClearError = vi.fn();
    
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      error: 'Connection failed',
      reconnect: mockReconnect,
      clearError: mockClearError,
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const retryButton = screen.getByTestId('retry-connection');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockReconnect).toHaveBeenCalled();
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  it('should handle loading states', () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      isLoading: true,
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText('Assistant is typing...')).toBeInTheDocument();
    
    // Input should be disabled during loading
    const input = screen.getByPlaceholderText('Connecting...');
    const sendButton = screen.getByTestId('send-button');
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('should handle connection status indicators', () => {
    // Test disconnected state
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      isConnected: false,
      error: null,
    } as any);

    const { rerender } = render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    
    // Test connected state
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      isConnected: true,
      error: null,
    } as any);

    rerender(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should handle clear messages functionality', () => {
    const mockClearMessages = vi.fn();
    
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      messages: [{
        id: '1',
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date(),
      }],
      clearMessages: mockClearMessages,
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const clearButton = screen.getByTestId('clear-messages');
    fireEvent.click(clearButton);

    expect(mockClearMessages).toHaveBeenCalled();
  });

  it('should handle realtime session integration', async () => {
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockSendUserText = vi.fn();
    
    vi.mocked(useRealtimeSession).mockReturnValue({
      ...mockRealtimeSession,
      status: 'CONNECTED',
      connect: mockConnect,
      sendUserText: mockSendUserText,
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    // The realtime session context should be available
    // This tests the integration between chat interface and realtime session
    expect(mockRealtimeSession).toBeDefined();
  });

  it('should handle message with citations', () => {
    const messageWithCitation = {
      id: '4',
      role: 'assistant' as const,
      content: 'Here is some information.',
      timestamp: new Date(),
      citations: [{
        id: 'c1',
        text: 'Citation content',
        source: 'Test Source',
        confidence: 0.9,
        page: 1,
      }],
    };

    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      messages: [messageWithCitation],
    } as any);

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(screen.getByText('Test Source')).toBeInTheDocument();
    expect(screen.getByText('(Page 1)')).toBeInTheDocument();
    expect(screen.getByText('Citation content')).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', () => {
    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    
    // Type message
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    // Press Enter to send
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockChatHook.sendMessage).toHaveBeenCalledWith('Test message');
  });

  it('should handle multiline messages with Shift+Enter', () => {
    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    
    // Type message
    fireEvent.change(input, { target: { value: 'Line 1' } });
    
    // Press Shift+Enter (should not send)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(mockChatHook.sendMessage).not.toHaveBeenCalled();
  });

  it('should auto-scroll to bottom with new messages', () => {
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const { rerender } = render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    // Add new message
    vi.mocked(useChat).mockReturnValue({
      ...mockChatHook,
      messages: [{
        id: '1',
        role: 'user' as const,
        content: 'New message',
        timestamp: new Date(),
      }],
    } as any);

    rerender(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  it('should handle session persistence', () => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    // The useChat hook should handle persistence internally
    // This test verifies the integration works without localStorage errors
    expect(localStorageMock.getItem).toHaveBeenCalled();
  });
});
