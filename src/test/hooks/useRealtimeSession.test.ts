import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';

// Mock the OpenAI agents SDK
vi.mock('@openai/agents/realtime', () => ({
  RealtimeSession: vi.fn(),
  OpenAIRealtimeWebRTC: vi.fn(),
}));

// Mock the codec utils
vi.mock('@/app/lib/codecUtils', () => ({
  audioFormatForCodec: vi.fn(() => 'pcm16'),
  applyCodecPreferences: vi.fn(),
}));

// Mock event context
vi.mock('@/app/contexts/EventContext', () => ({
  useEvent: () => ({
    logClientEvent: vi.fn(),
    logServerEvent: vi.fn(),
  }),
}));

// Mock session history handler
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

const mockSession = {
  connect: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  sendMessage: vi.fn(),
  interrupt: vi.fn(),
  mute: vi.fn(),
  transport: {
    sendEvent: vi.fn(),
  },
};

const { RealtimeSession } = await import('@openai/agents/realtime');
vi.mocked(RealtimeSession).mockImplementation(() => mockSession as any);

describe('useRealtimeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URLSearchParams = vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnValue('opus'),
    }));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should initialize with DISCONNECTED status', () => {
    const { result } = renderHook(() => useRealtimeSession());

    expect(result.current.status).toBe('DISCONNECTED');
    expect(result.current.currentAgent).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should handle successful connection', async () => {
    const { result } = renderHook(() => useRealtimeSession());
    
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'TestAgent' }];
    
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    expect(result.current.status).toBe('CONNECTED');
    expect(result.current.currentAgent).toBe('TestAgent');
    expect(mockSession.connect).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useRealtimeSession({
      onError: vi.fn(),
    }));
    
    const mockGetEphemeralKey = vi.fn().mockRejectedValue(new Error('API Error'));
    const mockAgents = [{ name: 'TestAgent' }];

    await act(async () => {
      try {
        await result.current.connect({
          getEphemeralKey: mockGetEphemeralKey,
          initialAgents: mockAgents,
          retryAttempts: 0, // Disable retries for this test
        });
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.status).toBe('DISCONNECTED');
    expect(result.current.lastError).toBeInstanceOf(Error);
  });

  it('should handle reconnection with exponential backoff', async () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => useRealtimeSession());
    
    const mockGetEphemeralKey = vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce('test-key');
    
    const mockAgents = [{ name: 'TestAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    // Start connection attempt
    act(() => {
      result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
        retryAttempts: 2,
        retryDelay: 1000,
      }).catch(() => {});
    });

    // Wait for first attempt to fail
    await waitFor(() => {
      expect(result.current.retryCount).toBe(1);
    });

    // Fast-forward past retry delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Wait for successful reconnection
    await waitFor(() => {
      expect(result.current.status).toBe('CONNECTED');
    });

    vi.useRealTimers();
  });

  it('should handle agent switching', async () => {
    const { result } = renderHook(() => useRealtimeSession({
      onAgentHandoff: vi.fn(),
    }));
    
    // First connect
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'InitialAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    // Switch agent
    await act(async () => {
      await result.current.switchAgent('NewAgent');
    });

    expect(result.current.currentAgent).toBe('NewAgent');
  });

  it('should handle disconnection', () => {
    const { result } = renderHook(() => useRealtimeSession());

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.status).toBe('DISCONNECTED');
    expect(result.current.currentAgent).toBeNull();
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('should send user text messages', async () => {
    const { result } = renderHook(() => useRealtimeSession());
    
    // First connect
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'TestAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    act(() => {
      result.current.sendUserText('Hello, assistant!');
    });

    expect(mockSession.sendMessage).toHaveBeenCalledWith('Hello, assistant!');
  });

  it('should handle push-to-talk functionality', async () => {
    const { result } = renderHook(() => useRealtimeSession());
    
    // First connect
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'TestAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    act(() => {
      result.current.pushToTalkStart();
    });

    expect(mockSession.transport.sendEvent).toHaveBeenCalledWith({ type: 'input_audio_buffer.clear' });

    act(() => {
      result.current.pushToTalkStop();
    });

    expect(mockSession.transport.sendEvent).toHaveBeenCalledWith({ type: 'input_audio_buffer.commit' });
    expect(mockSession.transport.sendEvent).toHaveBeenCalledWith({ type: 'response.create' });
  });

  it('should handle muting', async () => {
    const { result } = renderHook(() => useRealtimeSession());
    
    // First connect
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'TestAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    act(() => {
      result.current.mute(true);
    });

    expect(mockSession.mute).toHaveBeenCalledWith(true);
  });

  it('should handle interruption', async () => {
    const { result } = renderHook(() => useRealtimeSession());
    
    // First connect
    const mockGetEphemeralKey = vi.fn().mockResolvedValue('test-key');
    const mockAgents = [{ name: 'TestAgent' }];
    mockSession.connect.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.connect({
        getEphemeralKey: mockGetEphemeralKey,
        initialAgents: mockAgents,
      });
    });

    act(() => {
      result.current.interrupt();
    });

    expect(mockSession.interrupt).toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeSession());

    unmount();

    expect(mockSession.close).toHaveBeenCalled();
  });
});
