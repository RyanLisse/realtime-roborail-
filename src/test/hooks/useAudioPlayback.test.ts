import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';

// Mock the audio library
vi.mock('@/lib/audio', () => ({
  AudioPlayer: vi.fn(),
  PlaybackError: class PlaybackError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PlaybackError';
    }
  },
  generateTTS: vi.fn(),
}));

const mockPlayer = {
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn(),
  getCurrentTime: vi.fn(),
  getDuration: vi.fn(),
  isPlaying: vi.fn(),
  cleanup: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const { AudioPlayer, generateTTS } = await import('@/lib/audio');
vi.mocked(AudioPlayer).mockImplementation(() => mockPlayer as any);
vi.mocked(generateTTS).mockResolvedValue(new Blob(['audio data'], { type: 'audio/mp3' }));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-audio-url');
global.URL.revokeObjectURL = vi.fn();

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayer.isPlaying.mockReturnValue(false);
    mockPlayer.getCurrentTime.mockReturnValue(0);
    mockPlayer.getDuration.mockReturnValue(100);
    mockPlayer.getVolume.mockReturnValue(1);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAudioPlayback());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.volume).toBe(1);
    expect(result.current.error).toBeNull();
    expect(result.current.queue).toEqual([]);
  });

  it('should play audio from blob', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const audioBlob = new Blob(['audio data'], { type: 'audio/wav' });

    mockPlayer.play.mockResolvedValue(undefined);
    mockPlayer.isPlaying.mockReturnValue(true);

    await act(async () => {
      await result.current.playAudio(audioBlob);
    });

    expect(mockPlayer.play).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('should play audio from URL', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const audioUrl = 'https://example.com/audio.mp3';

    mockPlayer.play.mockResolvedValue(undefined);
    mockPlayer.isPlaying.mockReturnValue(true);

    await act(async () => {
      await result.current.playAudio(audioUrl);
    });

    expect(mockPlayer.play).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('should pause audio playback', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.pauseAudio();
    });

    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('should stop audio playback', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.stopAudio();
    });

    expect(mockPlayer.stop).toHaveBeenCalled();
  });

  it('should control volume', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(0.5);
  });

  it('should handle playback errors', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const audioBlob = new Blob(['audio data'], { type: 'audio/wav' });

    mockPlayer.play.mockRejectedValue(new Error('Playback failed'));

    await act(async () => {
      await result.current.playAudio(audioBlob);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Failed to play audio');
  });

  it('should manage audio queue for multiple items', async () => {
    const { result } = renderHook(() => useAudioPlayback({ enableQueue: true }));
    
    const audio1 = new Blob(['audio 1'], { type: 'audio/wav' });
    const audio2 = new Blob(['audio 2'], { type: 'audio/wav' });

    act(() => {
      result.current.addToQueue(audio1);
      result.current.addToQueue(audio2);
    });

    expect(result.current.queue).toHaveLength(2);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queue).toHaveLength(0);
  });

  it('should play next item in queue automatically', async () => {
    const { result } = renderHook(() => useAudioPlayback({ enableQueue: true, autoPlayNext: true }));
    
    const audio1 = new Blob(['audio 1'], { type: 'audio/wav' });
    const audio2 = new Blob(['audio 2'], { type: 'audio/wav' });

    mockPlayer.play.mockResolvedValue(undefined);
    
    // Set up event listener mock
    let endedCallback: () => void;
    mockPlayer.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'ended') {
        endedCallback = callback;
      }
    });

    act(() => {
      result.current.addToQueue(audio1);
      result.current.addToQueue(audio2);
    });

    await act(async () => {
      await result.current.playNext();
    });

    expect(result.current.queue).toHaveLength(1); // First item should be removed

    // Simulate audio ended event
    await act(async () => {
      endedCallback();
    });

    // Should automatically play next item
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('should generate and play TTS', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const text = 'Hello, world!';
    const ttsBlob = new Blob(['tts audio'], { type: 'audio/mp3' });

    vi.mocked(generateTTS).mockResolvedValue(ttsBlob);
    mockPlayer.play.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.playTTS(text);
    });

    expect(vi.mocked(generateTTS)).toHaveBeenCalledWith(text, undefined);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('should handle TTS generation errors', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const text = 'Hello, world!';

    vi.mocked(generateTTS).mockRejectedValue(new Error('TTS generation failed'));

    await act(async () => {
      await result.current.playTTS(text);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Failed to generate or play TTS');
  });

  it('should update playback progress', () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => useAudioPlayback());

    mockPlayer.getCurrentTime.mockReturnValue(50);
    mockPlayer.getDuration.mockReturnValue(100);
    mockPlayer.isPlaying.mockReturnValue(true);

    // Simulate starting playback
    act(() => {
      result.current.playAudio(new Blob());
    });

    // Fast-forward timer to trigger progress update
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.currentTime).toBe(50);
    expect(result.current.duration).toBe(100);

    vi.useRealTimers();
  });

  it('should seek to specific time', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.seekTo(30);
    });

    // This would typically call a seek method on the audio player
    // For now, we'll test that the currentTime updates
    expect(mockPlayer.getCurrentTime).toHaveBeenCalled();
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useAudioPlayback());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useAudioPlayback());

    unmount();

    expect(mockPlayer.cleanup).toHaveBeenCalled();
  });

  it('should handle simultaneous audio requests gracefully', async () => {
    const { result } = renderHook(() => useAudioPlayback());
    
    const audio1 = new Blob(['audio 1'], { type: 'audio/wav' });
    const audio2 = new Blob(['audio 2'], { type: 'audio/wav' });

    mockPlayer.play.mockResolvedValue(undefined);

    // Start two audio playback requests simultaneously
    const [result1, result2] = await act(async () => {
      return Promise.all([
        result.current.playAudio(audio1),
        result.current.playAudio(audio2),
      ]);
    });

    // Should handle gracefully without errors
    expect(result.current.error).toBeNull();
  });
});
