import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChat } from '@/hooks/useChat';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty messages and not loading', () => {
    const { result } = renderHook(() => useChat());
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should add a user message when sendMessage is called', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Hello from assistant' }),
    });

    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('Hello from user');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      id: expect.any(String),
      role: 'user',
      content: 'Hello from user',
      timestamp: expect.any(Date),
    });
    expect(result.current.messages[1]).toEqual({
      id: expect.any(String),
      role: 'assistant',
      content: 'Hello from assistant',
      timestamp: expect.any(Date),
    });
  });

  it('should set loading state during API call', async () => {
    let resolvePromise: (value: any) => void;
    const apiPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(apiPromise);

    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('Test message');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({ message: 'Response' }),
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBe('Failed to send message: 500 Internal Server Error');
    expect(result.current.messages).toHaveLength(1); // Only user message
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBe('Failed to send message: Network error');
  });

  it('should clear messages when clearMessages is called', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Response' }),
    });

    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it('should clear error when clearError is called', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });
});