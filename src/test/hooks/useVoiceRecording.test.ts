import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useVoiceRecording,
  useVoiceRecordingWithTranscription,
  usePushToTalk,
  useAutomaticVoiceRecording,
} from '@/hooks/useVoiceRecording';

// Mock the audio library
vi.mock('@/lib/audio', () => ({
  AudioRecorder: vi.fn(),
  RecordingError: class RecordingError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RecordingError';
    }
  },
  transcribeAudio: vi.fn(),
  createVAD: vi.fn(),
  getOptimalVADConfig: vi.fn(),
}));

const mockRecorder = {
  requestMicrophoneAccess: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
  getRecordingDuration: vi.fn(),
  getRMSLevel: vi.fn(),
  cleanup: vi.fn(),
};

const { AudioRecorder, transcribeAudio, createVAD, getOptimalVADConfig } = await import('@/lib/audio');
vi.mocked(AudioRecorder).mockImplementation(() => mockRecorder as any);
vi.mocked(transcribeAudio).mockResolvedValue({ text: 'Transcribed text' });
vi.mocked(createVAD).mockReturnValue({
  startListening: vi.fn(),
  stopListening: vi.fn(),
});
vi.mocked(getOptimalVADConfig).mockReturnValue({
  threshold: 0.5,
  minSilenceDuration: 1000,
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

describe('useVoiceRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVoiceRecording());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.level).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('should start recording successfully', async () => {
    const { result } = renderHook(() => useVoiceRecording());

    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.getRecordingDuration.mockReturnValue(1000);
    mockRecorder.getRMSLevel.mockReturnValue(0.5);

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockRecorder.requestMicrophoneAccess).toHaveBeenCalled();
    expect(mockRecorder.startRecording).toHaveBeenCalled();

    // Fast-forward timers to test duration and level updates
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.duration).toBe(1000);
    expect(result.current.level).toBe(0.5);
  });

  it('should handle recording start errors', async () => {
    const { result } = renderHook(() => useVoiceRecording());

    mockRecorder.requestMicrophoneAccess.mockRejectedValue(new Error('Microphone access denied'));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Failed to start recording');
  });

  it('should stop recording and return audio blob', async () => {
    const { result } = renderHook(() => useVoiceRecording());
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });

    // Start recording first
    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(mockBlob);

    await act(async () => {
      await result.current.startRecording();
    });

    let audioResult: Blob | null = null;
    await act(async () => {
      audioResult = await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.level).toBe(0);
    expect(audioResult).toBe(mockBlob);
    expect(mockRecorder.stopRecording).toHaveBeenCalled();
  });

  it('should pause and resume recording', async () => {
    const { result } = renderHook(() => useVoiceRecording());

    // Start recording first
    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.pauseRecording.mockImplementation(() => {});
    mockRecorder.resumeRecording.mockImplementation(() => {});
    mockRecorder.getRecordingDuration.mockReturnValue(1000);
    mockRecorder.getRMSLevel.mockReturnValue(0.3);

    await act(async () => {
      await result.current.startRecording();
    });

    // Pause recording
    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.isPaused).toBe(true);
    expect(mockRecorder.pauseRecording).toHaveBeenCalled();

    // Resume recording
    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.isPaused).toBe(false);
    expect(mockRecorder.resumeRecording).toHaveBeenCalled();
  });

  it('should clear errors', () => {
    const { result } = renderHook(() => useVoiceRecording());

    // Set an error state
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useVoiceRecording());

    unmount();

    expect(mockRecorder.cleanup).toHaveBeenCalled();
  });
});

describe('useVoiceRecordingWithTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stop recording and transcribe audio', async () => {
    const { result } = renderHook(() => useVoiceRecordingWithTranscription());
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });

    // Mock recording setup
    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(mockBlob);
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'Hello world' });

    // Start recording
    await act(async () => {
      await result.current.startRecording();
    });

    // Stop and transcribe
    let transcriptionResult: any = null;
    await act(async () => {
      transcriptionResult = await result.current.stopRecordingAndTranscribe();
    });

    expect(result.current.transcription).toBe('Hello world');
    expect(transcriptionResult.audio).toBe(mockBlob);
    expect(transcriptionResult.transcription).toBe('Hello world');
    expect(vi.mocked(transcribeAudio)).toHaveBeenCalledWith(mockBlob, undefined);
  });

  it('should handle transcription errors', async () => {
    const { result } = renderHook(() => useVoiceRecordingWithTranscription());
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });

    // Mock recording setup
    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(mockBlob);
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('Transcription failed'));

    // Start recording
    await act(async () => {
      await result.current.startRecording();
    });

    // Stop and transcribe
    await act(async () => {
      await result.current.stopRecordingAndTranscribe();
    });

    expect(result.current.transcriptionError).toBeTruthy();
    expect(result.current.transcriptionError?.message).toBe('Transcription failed');
  });

  it('should clear transcription', () => {
    const { result } = renderHook(() => useVoiceRecordingWithTranscription());

    act(() => {
      result.current.clearTranscription();
    });

    expect(result.current.transcription).toBe('');
    expect(result.current.transcriptionError).toBeNull();
  });
});

describe('usePushToTalk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle press start and end', async () => {
    const onTranscription = vi.fn();
    const onAudio = vi.fn();
    
    const { result } = renderHook(() => usePushToTalk({
      onTranscription,
      onAudio,
    }));

    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(mockBlob);
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'Push to talk test' });

    // Press start
    await act(async () => {
      await result.current.handlePressStart();
    });

    expect(result.current.isPressed).toBe(true);
    expect(result.current.isRecording).toBe(true);

    // Press end
    await act(async () => {
      await result.current.handlePressEnd();
    });

    expect(result.current.isPressed).toBe(false);
    expect(onAudio).toHaveBeenCalledWith(mockBlob);
    expect(onTranscription).toHaveBeenCalledWith('Push to talk test');
  });

  it('should handle keyboard space key events', async () => {
    const { result } = renderHook(() => usePushToTalk());

    mockRecorder.requestMicrophoneAccess.mockResolvedValue(undefined);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(new Blob());
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'Space key test' });

    // Simulate space key down
    const keyDownEvent = new KeyboardEvent('keydown', { code: 'Space' });
    await act(async () => {
      window.dispatchEvent(keyDownEvent);
    });

    await waitFor(() => {
      expect(result.current.isPressed).toBe(true);
    });

    // Simulate space key up
    const keyUpEvent = new KeyboardEvent('keyup', { code: 'Space' });
    await act(async () => {
      window.dispatchEvent(keyUpEvent);
    });

    await waitFor(() => {
      expect(result.current.isPressed).toBe(false);
    });
  });
});

describe('useAutomaticVoiceRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start and stop listening with VAD', async () => {
    const onRecordingComplete = vi.fn();
    const onTranscription = vi.fn();
    
    const { result } = renderHook(() => useAutomaticVoiceRecording({
      onRecordingComplete,
      onTranscription,
    }));

    const mockVAD = {
      startListening: vi.fn(),
      stopListening: vi.fn(),
    };
    
    vi.mocked(createVAD).mockReturnValue(mockVAD);
    vi.mocked(getOptimalVADConfig).mockReturnValue({ threshold: 0.5 });

    // Start listening
    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(mockVAD.startListening).toHaveBeenCalled();
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalled();

    // Stop listening
    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(mockVAD.stopListening).toHaveBeenCalled();
  });

  it('should handle VAD speech detection callbacks', async () => {
    const onRecordingComplete = vi.fn();
    const onTranscription = vi.fn();
    
    const { result } = renderHook(() => useAutomaticVoiceRecording({
      onRecordingComplete,
      onTranscription,
    }));

    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
    let vadCallback: any;
    
    const mockVAD = {
      startListening: vi.fn((stream, callback) => {
        vadCallback = callback;
      }),
      stopListening: vi.fn(),
    };
    
    vi.mocked(createVAD).mockReturnValue(mockVAD);
    mockRecorder.startRecording.mockResolvedValue(undefined);
    mockRecorder.stopRecording.mockResolvedValue(mockBlob);
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'VAD detected speech' });

    // Start listening
    await act(async () => {
      await result.current.startListening();
    });

    // Simulate VAD detecting speech
    await act(async () => {
      vadCallback({ isSpeechActive: true, silenceDuration: 0 });
    });

    // Simulate VAD detecting silence (should stop recording)
    await act(async () => {
      vadCallback({ isSpeechActive: false, silenceDuration: 1500 });
    });

    await waitFor(() => {
      expect(onRecordingComplete).toHaveBeenCalledWith(mockBlob);
      expect(onTranscription).toHaveBeenCalledWith('VAD detected speech');
    });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useAutomaticVoiceRecording());

    unmount();

    // Should have called cleanup through stopListening
    expect(mockRecorder.cleanup).toHaveBeenCalled();
  });
});
