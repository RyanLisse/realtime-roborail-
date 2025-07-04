import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVoiceActivity } from '@/hooks/useVoiceActivity';

// Mock the audio library
vi.mock('@/lib/audio', () => ({
  createVAD: vi.fn(),
  getOptimalVADConfig: vi.fn(),
  VADConfig: {},
}));

const mockVAD = {
  startListening: vi.fn(),
  stopListening: vi.fn(),
  destroy: vi.fn(),
  updateConfig: vi.fn(),
  getMetrics: vi.fn(),
};

const { createVAD, getOptimalVADConfig } = await import('@/lib/audio');
vi.mocked(createVAD).mockReturnValue(mockVAD);
vi.mocked(getOptimalVADConfig).mockReturnValue({
  threshold: 0.5,
  minSilenceDuration: 1000,
  maxSilenceDuration: 3000,
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

describe('useVoiceActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVoiceActivity());

    expect(result.current.isListening).toBe(false);
    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.audioLevel).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.metrics).toEqual({
      totalSpeechTime: 0,
      totalSilenceTime: 0,
      speechSegments: 0,
    });
  });

  it('should start listening for voice activity', async () => {
    const { result } = renderHook(() => useVoiceActivity());

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(mockVAD.startListening).toHaveBeenCalled();
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalledWith({ audio: true });
  });

  it('should handle voice activity detection', async () => {
    const onSpeechStart = vi.fn();
    const onSpeechEnd = vi.fn();
    
    const { result } = renderHook(() => useVoiceActivity({
      onSpeechStart,
      onSpeechEnd,
    }));

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate speech detection
    await act(async () => {
      vadCallback({
        isSpeechActive: true,
        audioLevel: 0.8,
        silenceDuration: 0,
        speechDuration: 1000,
      });
    });

    expect(result.current.isSpeaking).toBe(true);
    expect(result.current.audioLevel).toBe(0.8);
    expect(onSpeechStart).toHaveBeenCalled();

    // Simulate silence detection
    await act(async () => {
      vadCallback({
        isSpeechActive: false,
        audioLevel: 0.1,
        silenceDuration: 2000,
        speechDuration: 1000,
      });
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.audioLevel).toBe(0.1);
    expect(onSpeechEnd).toHaveBeenCalled();
  });

  it('should stop listening', () => {
    const { result } = renderHook(() => useVoiceActivity());

    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(mockVAD.stopListening).toHaveBeenCalled();
  });

  it('should handle microphone access errors', async () => {
    const { result } = renderHook(() => useVoiceActivity());

    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new Error('Microphone access denied')
    );

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Failed to start voice activity detection');
    expect(result.current.isListening).toBe(false);
  });

  it('should handle VAD initialization errors', async () => {
    const { result } = renderHook(() => useVoiceActivity());

    mockVAD.startListening.mockRejectedValue(new Error('VAD initialization failed'));

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isListening).toBe(false);
  });

  it('should update configuration dynamically', () => {
    const { result } = renderHook(() => useVoiceActivity());

    const newConfig = {
      threshold: 0.7,
      minSilenceDuration: 1500,
    };

    act(() => {
      result.current.updateConfig(newConfig);
    });

    expect(mockVAD.updateConfig).toHaveBeenCalledWith(newConfig);
  });

  it('should track speech metrics', async () => {
    const { result } = renderHook(() => useVoiceActivity());

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });
    
    mockVAD.getMetrics.mockReturnValue({
      totalSpeechTime: 5000,
      totalSilenceTime: 2000,
      speechSegments: 3,
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate speech activity to trigger metrics update
    await act(async () => {
      vadCallback({
        isSpeechActive: true,
        audioLevel: 0.8,
        silenceDuration: 0,
        speechDuration: 1000,
      });
    });

    expect(result.current.metrics).toEqual({
      totalSpeechTime: 5000,
      totalSilenceTime: 2000,
      speechSegments: 3,
    });
  });

  it('should handle silence timeout callbacks', async () => {
    const onSilenceTimeout = vi.fn();
    
    const { result } = renderHook(() => useVoiceActivity({
      onSilenceTimeout,
      config: {
        maxSilenceDuration: 3000,
      },
    }));

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate extended silence
    await act(async () => {
      vadCallback({
        isSpeechActive: false,
        audioLevel: 0.1,
        silenceDuration: 4000, // Exceeds maxSilenceDuration
        speechDuration: 0,
      });
    });

    expect(onSilenceTimeout).toHaveBeenCalled();
  });

  it('should handle audio level changes', async () => {
    const onAudioLevelChange = vi.fn();
    
    const { result } = renderHook(() => useVoiceActivity({
      onAudioLevelChange,
    }));

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate various audio levels
    const levels = [0.2, 0.5, 0.8, 0.3];
    
    for (const level of levels) {
      await act(async () => {
        vadCallback({
          isSpeechActive: level > 0.5,
          audioLevel: level,
          silenceDuration: 0,
          speechDuration: 1000,
        });
      });
      
      expect(onAudioLevelChange).toHaveBeenCalledWith(level);
    }
  });

  it('should use custom VAD configuration', () => {
    const customConfig = {
      threshold: 0.3,
      minSilenceDuration: 500,
      maxSilenceDuration: 5000,
    };

    renderHook(() => useVoiceActivity({ config: customConfig }));

    expect(vi.mocked(createVAD)).toHaveBeenCalledWith(customConfig);
  });

  it('should use optimal VAD configuration when none provided', () => {
    const vadMode = 'conversation';
    
    renderHook(() => useVoiceActivity({ vadMode }));

    expect(vi.mocked(getOptimalVADConfig)).toHaveBeenCalledWith(vadMode);
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useVoiceActivity());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useVoiceActivity());

    unmount();

    expect(mockVAD.destroy).toHaveBeenCalled();
  });

  it('should handle rapid speech state changes', async () => {
    const onSpeechStart = vi.fn();
    const onSpeechEnd = vi.fn();
    
    const { result } = renderHook(() => useVoiceActivity({
      onSpeechStart,
      onSpeechEnd,
    }));

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate rapid speech on/off cycles
    const events = [
      { isSpeechActive: true, audioLevel: 0.8 },
      { isSpeechActive: false, audioLevel: 0.2 },
      { isSpeechActive: true, audioLevel: 0.9 },
      { isSpeechActive: false, audioLevel: 0.1 },
    ];

    for (const event of events) {
      await act(async () => {
        vadCallback({
          ...event,
          silenceDuration: event.isSpeechActive ? 0 : 1000,
          speechDuration: event.isSpeechActive ? 1000 : 0,
        });
      });
    }

    expect(onSpeechStart).toHaveBeenCalledTimes(2);
    expect(onSpeechEnd).toHaveBeenCalledTimes(2);
  });

  it('should debounce rapid state changes', async () => {
    const { result } = renderHook(() => useVoiceActivity({
      config: {
        debounceMs: 100,
      },
    }));

    let vadCallback: any;
    mockVAD.startListening.mockImplementation((stream, callback) => {
      vadCallback = callback;
      return Promise.resolve();
    });

    await act(async () => {
      await result.current.startListening();
    });

    // Rapid state changes within debounce period
    vadCallback({ isSpeechActive: true, audioLevel: 0.8 });
    vadCallback({ isSpeechActive: false, audioLevel: 0.2 });
    vadCallback({ isSpeechActive: true, audioLevel: 0.9 });

    // Should debounce and only apply the final state
    await waitFor(() => {
      expect(result.current.isSpeaking).toBe(true);
    });
  });
});
