import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';

// Mock all dependencies
vi.mock('@/hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/app/hooks/useRealtimeSession', () => ({
  useRealtimeSession: vi.fn(),
}));

vi.mock('@/contexts/RealtimeSessionContext', () => ({
  useOptionalRealtimeSession: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

const mockChat = {
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

const mockRealtimeContext = {
  sessionState: {
    status: 'DISCONNECTED',
    isVoiceEnabled: false,
  },
  isInitialized: false,
  connectionOptions: {
    getEphemeralKey: () => Promise.resolve('test-key'),
    initialAgents: [{ name: 'TestAgent' }],
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  switchAgent: vi.fn(),
  mute: vi.fn(),
  sendMessage: vi.fn(),
};

const { useChat } = await import('@/hooks/useChat');
const { useRealtimeSession } = await import('@/app/hooks/useRealtimeSession');
const { useOptionalRealtimeSession } = await import('@/contexts/RealtimeSessionContext');

vi.mocked(useChat).mockReturnValue(mockChat as any);
vi.mocked(useRealtimeSession).mockReturnValue(mockRealtimeSession as any);
vi.mocked(useOptionalRealtimeSession).mockReturnValue(mockRealtimeContext as any);

describe('useRealtimeChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRealtimeChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isRealtimeActive).toBe(false);
    expect(result.current.isMuted).toBe(false);
  });

  it('should send messages via regular chat when realtime is inactive', async () => {
    const { result } = renderHook(() => useRealtimeChat());

    await act(async () => {
      await result.current.sendMessage('Hello, world!');
    });

    expect(mockChat.sendMessage).toHaveBeenCalledWith('Hello, world!');
    expect(mockRealtimeSession.sendUserText).not.toHaveBeenCalled();
  });

  it('should handle realtime session connection', async () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return mockRealtimeSession as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Simulate connection
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    expect(result.current.isRealtimeActive).toBe(true);
    expect(result.current.realtimeStatus).toBe('CONNECTED');
  });

  it('should send messages via realtime when active', async () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return {
        ...mockRealtimeSession,
        status: 'CONNECTED',
      } as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Activate realtime
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    await act(async () => {
      await result.current.sendMessage('Hello via realtime!');
    });

    expect(mockRealtimeSession.sendUserText).toHaveBeenCalledWith('Hello via realtime!');
    expect(mockChat.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle realtime connection errors with fallback', async () => {
    const onError = vi.fn();
    let errorCallback: ((error: Error) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      errorCallback = callbacks?.onError;
      return mockRealtimeSession as any;
    });

    const { result } = renderHook(() => useRealtimeChat({
      enableFallback: true,
      onError,
    }));

    const error = new Error('Connection failed');
    act(() => {
      errorCallback?.(error);
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should queue messages when realtime is connecting', async () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return {
        ...mockRealtimeSession,
        status: 'CONNECTING',
      } as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Set realtime as active but not connected
    act(() => {
      connectionCallback?.('CONNECTING');
    });

    // Manually set realtime active for testing
    act(() => {
      // Simulate the state where realtime is intended to be active but not connected
      connectionCallback?.('CONNECTED');
      connectionCallback?.('CONNECTING');
    });

    await act(async () => {
      await result.current.sendMessage('Queued message');
    });

    // When connection is restored, queued messages should be sent
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    await waitFor(() => {
      expect(mockRealtimeSession.sendUserText).toHaveBeenCalledWith('Queued message');
    });
  });

  it('should handle voice messages', async () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return {
        ...mockRealtimeSession,
        status: 'CONNECTED',
      } as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Activate realtime
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    const audioBlob = new Blob(['audio data'], { type: 'audio/wav' });
    
    await act(async () => {
      await result.current.sendVoiceMessage(audioBlob);
    });

    expect(mockRealtimeSession.sendEvent).toHaveBeenCalledWith({
      type: 'input_audio_buffer.append',
      audio: expect.any(Uint8Array),
    });
    expect(mockRealtimeSession.sendEvent).toHaveBeenCalledWith({
      type: 'input_audio_buffer.commit',
    });
    expect(mockRealtimeSession.sendEvent).toHaveBeenCalledWith({
      type: 'response.create',
    });
  });

  it('should handle muting and unmuting', () => {
    const { result } = renderHook(() => useRealtimeChat());

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(mockRealtimeSession.mute).toHaveBeenCalledWith(true);
    expect(mockRealtimeContext.mute).toHaveBeenCalledWith(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
    expect(mockRealtimeSession.mute).toHaveBeenCalledWith(false);
    expect(mockRealtimeContext.mute).toHaveBeenCalledWith(false);
  });

  it('should handle interruption', () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return {
        ...mockRealtimeSession,
        status: 'CONNECTED',
      } as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Activate realtime
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    act(() => {
      result.current.interrupt();
    });

    expect(mockRealtimeSession.interrupt).toHaveBeenCalled();
  });

  it('should handle agent switching', async () => {
    const { result } = renderHook(() => useRealtimeChat());

    await act(async () => {
      await result.current.switchAgent('NewAgent');
    });

    expect(mockChat.switchAgent).toHaveBeenCalledWith('NewAgent');

    // When realtime is active
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return mockRealtimeSession as any;
    });

    const { result: realtimeResult } = renderHook(() => useRealtimeChat());

    act(() => {
      connectionCallback?.('CONNECTED');
    });

    await act(async () => {
      await realtimeResult.current.switchAgent('RealtimeAgent');
    });

    expect(mockRealtimeSession.switchAgent).toHaveBeenCalledWith('RealtimeAgent');
  });

  it('should handle auto-reconnection', async () => {
    let connectionCallback: ((status: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      connectionCallback = callbacks?.onConnectionChange;
      return mockRealtimeSession as any;
    });

    const { result } = renderHook(() => useRealtimeChat({
      autoReconnect: true,
      maxReconnectAttempts: 2,
    }));

    // First connect
    act(() => {
      connectionCallback?.('CONNECTED');
    });

    expect(result.current.isRealtimeActive).toBe(true);

    // Simulate disconnection
    act(() => {
      connectionCallback?.('ERROR');
    });

    expect(result.current.isRealtimeActive).toBe(false);

    // Fast-forward to trigger auto-reconnect
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockRealtimeSession.reconnect).toHaveBeenCalled();
    });
  });

  it('should toggle realtime mode', async () => {
    const { result } = renderHook(() => useRealtimeChat());

    // Enable realtime
    await act(async () => {
      await result.current.toggleRealtime();
    });

    expect(mockRealtimeContext.connect).toHaveBeenCalledWith(mockRealtimeContext.connectionOptions);

    // Disable realtime
    await act(async () => {
      await result.current.toggleRealtime();
    });

    expect(mockRealtimeSession.disconnect).toHaveBeenCalled();
    expect(mockRealtimeContext.disconnect).toHaveBeenCalled();
  });

  it('should handle message clearing', () => {
    const { result } = renderHook(() => useRealtimeChat());

    act(() => {
      result.current.clearMessages();
    });

    expect(mockChat.clearMessages).toHaveBeenCalled();
  });

  it('should handle error clearing', () => {
    const { result } = renderHook(() => useRealtimeChat());

    act(() => {
      result.current.clearError();
    });

    expect(mockChat.clearError).toHaveBeenCalled();
  });

  it('should handle disconnection', () => {
    const { result } = renderHook(() => useRealtimeChat());

    act(() => {
      result.current.disconnect();
    });

    expect(mockRealtimeSession.disconnect).toHaveBeenCalled();
    expect(mockRealtimeContext.disconnect).toHaveBeenCalled();
    expect(result.current.isRealtimeActive).toBe(false);
  });

  it('should handle reconnection', async () => {
    const { result } = renderHook(() => useRealtimeChat());

    await act(async () => {
      await result.current.reconnect();
    });

    expect(mockChat.reconnect).toHaveBeenCalled();
  });

  it('should handle realtime message events', async () => {
    let messageCallback: ((message: any) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      messageCallback = callbacks?.onMessage;
      return mockRealtimeSession as any;
    });

    const { result } = renderHook(() => useRealtimeChat());

    // Simulate incoming realtime message
    act(() => {
      messageCallback?.({
        content: 'Hello from realtime!',
        metadata: { timestamp: Date.now() },
      });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello from realtime!');
      expect(result.current.messages[0].role).toBe('assistant');
    });
  });

  it('should handle agent handoff callbacks', () => {
    const onAgentHandoff = vi.fn();
    let handoffCallback: ((agentName: string) => void) | undefined;
    
    vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
      handoffCallback = callbacks?.onAgentHandoff;
      return mockRealtimeSession as any;
    });

    renderHook(() => useRealtimeChat({ onAgentHandoff }));

    act(() => {
      handoffCallback?.('NewAgent');
    });

    expect(onAgentHandoff).toHaveBeenCalledWith('NewAgent');
  });

  it('should handle realtime context initialization', () => {
    vi.mocked(useOptionalRealtimeSession).mockReturnValue({
      ...mockRealtimeContext,
      sessionState: {
        ...mockRealtimeContext.sessionState,
        status: 'CONNECTED',
      },
    } as any);

    const { result } = renderHook(() => useRealtimeChat());

    expect(result.current.isRealtimeActive).toBe(true);
  });
});
