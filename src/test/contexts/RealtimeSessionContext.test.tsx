import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RealtimeSessionProvider,
  useRealtimeSessionContext,
  useOptionalRealtimeSession,
} from '@/contexts/RealtimeSessionContext';

// Mock the useRealtimeSession hook
vi.mock('@/app/hooks/useRealtimeSession', () => ({
  useRealtimeSession: vi.fn(),
}));

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

const { useRealtimeSession } = await import('@/app/hooks/useRealtimeSession');
vi.mocked(useRealtimeSession).mockReturnValue(mockRealtimeSession as any);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RealtimeSessionProvider>{children}</RealtimeSessionProvider>
);

describe('RealtimeSessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRealtimeSession).mockReturnValue(mockRealtimeSession as any);
  });

  describe('useRealtimeSessionContext', () => {
    it('should provide session state and methods', () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      expect(result.current).toMatchObject({
        sessionState: {
          status: 'DISCONNECTED',
          isVoiceEnabled: false,
        },
        isInitialized: false,
        connectionOptions: null,
      });

      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.switchAgent).toBe('function');
      expect(typeof result.current.toggleVoice).toBe('function');
      expect(typeof result.current.mute).toBe('function');
      expect(typeof result.current.sendMessage).toBe('function');
    });

    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useRealtimeSessionContext());
      }).toThrow('useRealtimeSessionContext must be used within a RealtimeSessionProvider');
    });

    it('should handle connection', async () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      const connectOptions = {
        getEphemeralKey: () => Promise.resolve('test-key'),
        initialAgents: [{ name: 'TestAgent' }],
      };

      await act(async () => {
        await result.current.connect(connectOptions);
      });

      expect(mockRealtimeSession.connect).toHaveBeenCalledWith(connectOptions);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.connectionOptions).toBe(connectOptions);
    });

    it('should handle disconnection', () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      act(() => {
        result.current.disconnect();
      });

      expect(mockRealtimeSession.disconnect).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.connectionOptions).toBeNull();
    });

    it('should handle reconnection', async () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      // First connect to set connection options
      const connectOptions = {
        getEphemeralKey: () => Promise.resolve('test-key'),
        initialAgents: [{ name: 'TestAgent' }],
      };

      await act(async () => {
        await result.current.connect(connectOptions);
      });

      // Then reconnect
      await act(async () => {
        await result.current.reconnect();
      });

      expect(mockRealtimeSession.reconnect).toHaveBeenCalled();
    });

    it('should throw error on reconnect without connection options', async () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      await expect(async () => {
        await act(async () => {
          await result.current.reconnect();
        });
      }).rejects.toThrow('No connection options available for reconnect');
    });

    it('should handle agent switching', async () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      await act(async () => {
        await result.current.switchAgent('NewAgent');
      });

      expect(mockRealtimeSession.switchAgent).toHaveBeenCalledWith('NewAgent');
    });

    it('should handle voice toggle', () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      act(() => {
        result.current.toggleVoice();
      });

      expect(mockRealtimeSession.mute).toHaveBeenCalledWith(false);
      expect(result.current.sessionState.isVoiceEnabled).toBe(true);

      act(() => {
        result.current.toggleVoice();
      });

      expect(mockRealtimeSession.mute).toHaveBeenCalledWith(true);
      expect(result.current.sessionState.isVoiceEnabled).toBe(false);
    });

    it('should handle muting', () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      act(() => {
        result.current.mute(true);
      });

      expect(mockRealtimeSession.mute).toHaveBeenCalledWith(true);
      expect(result.current.sessionState.isVoiceEnabled).toBe(false);

      act(() => {
        result.current.mute(false);
      });

      expect(mockRealtimeSession.mute).toHaveBeenCalledWith(false);
      expect(result.current.sessionState.isVoiceEnabled).toBe(true);
    });

    it('should handle sending messages', () => {
      const { result } = renderHook(() => useRealtimeSessionContext(), { wrapper });

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(mockRealtimeSession.sendUserText).toHaveBeenCalledWith('Hello, world!');
    });
  });

  describe('useOptionalRealtimeSession', () => {
    it('should return context when inside provider', () => {
      const { result } = renderHook(() => useOptionalRealtimeSession(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.sessionState.status).toBe('DISCONNECTED');
    });

    it('should return undefined when outside provider', () => {
      const { result } = renderHook(() => useOptionalRealtimeSession());

      expect(result.current).toBeUndefined();
    });
  });

  describe('auto-reconnect functionality', () => {
    it('should auto-reconnect on error when enabled', async () => {
      vi.useFakeTimers();
      
      // Mock a session with error status
      const errorSession = {
        ...mockRealtimeSession,
        status: 'ERROR',
        retryCount: 0,
      };
      
      vi.mocked(useRealtimeSession).mockReturnValue(errorSession as any);

      const autoReconnectWrapper = ({ children }: { children: React.ReactNode }) => (
        <RealtimeSessionProvider autoReconnect={true}>
          {children}
        </RealtimeSessionProvider>
      );

      const { result } = renderHook(() => useRealtimeSessionContext(), { 
        wrapper: autoReconnectWrapper 
      });

      // Set connection options first
      const connectOptions = {
        getEphemeralKey: () => Promise.resolve('test-key'),
        initialAgents: [{ name: 'TestAgent' }],
      };

      await act(async () => {
        await result.current.connect(connectOptions);
      });

      // Simulate error state change
      vi.mocked(useRealtimeSession).mockReturnValue({
        ...errorSession,
        status: 'ERROR',
      } as any);

      // Fast-forward timer to trigger auto-reconnect
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockRealtimeSession.connect).toHaveBeenCalledTimes(2); // Initial + retry
      });

      vi.useRealTimers();
    });

    it('should not auto-reconnect when disabled', async () => {
      vi.useFakeTimers();
      
      const autoReconnectWrapper = ({ children }: { children: React.ReactNode }) => (
        <RealtimeSessionProvider autoReconnect={false}>
          {children}
        </RealtimeSessionProvider>
      );

      renderHook(() => useRealtimeSessionContext(), { 
        wrapper: autoReconnectWrapper 
      });

      // Fast-forward timer
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have triggered any reconnection attempts
      expect(mockRealtimeSession.connect).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('callback handling', () => {
    it('should call onAgentHandoff callback', () => {
      const onAgentHandoff = vi.fn();
      
      const callbackWrapper = ({ children }: { children: React.ReactNode }) => (
        <RealtimeSessionProvider onAgentHandoff={onAgentHandoff}>
          {children}
        </RealtimeSessionProvider>
      );

      // Simulate the callback being triggered by the hook
      const mockWithCallback = {
        ...mockRealtimeSession,
      };
      
      vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
        // Simulate an agent handoff event
        setTimeout(() => {
          callbacks?.onAgentHandoff?.('NewAgent');
        }, 0);
        
        return mockWithCallback as any;
      });

      renderHook(() => useRealtimeSessionContext(), { wrapper: callbackWrapper });

      expect(onAgentHandoff).toHaveBeenCalledWith('NewAgent');
    });

    it('should call onError callback', () => {
      const onError = vi.fn();
      
      const callbackWrapper = ({ children }: { children: React.ReactNode }) => (
        <RealtimeSessionProvider onError={onError}>
          {children}
        </RealtimeSessionProvider>
      );

      // Simulate the error callback being triggered by the hook
      const error = new Error('Connection failed');
      
      vi.mocked(useRealtimeSession).mockImplementation((callbacks) => {
        // Simulate an error event
        setTimeout(() => {
          callbacks?.onError?.(error);
        }, 0);
        
        return mockRealtimeSession as any;
      });

      renderHook(() => useRealtimeSessionContext(), { wrapper: callbackWrapper });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
