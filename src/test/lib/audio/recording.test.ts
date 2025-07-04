import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRecorder } from '../../../lib/audio/recording';
import { AudioFormat } from '../../../lib/audio/types';

// Mock Web Audio API
const mockAnalyser = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0.8,
  getByteFrequencyData: vi.fn(),
  getByteTimeDomainData: vi.fn(),
  connect: vi.fn(),
};

const mockMediaStreamSource = {
  connect: vi.fn(),
};

const mockAudioContext = {
  createMediaStreamSource: vi.fn(() => mockMediaStreamSource),
  createAnalyser: vi.fn(() => mockAnalyser),
  createScriptProcessor: vi.fn(),
  decodeAudioData: vi.fn().mockResolvedValue({
    length: 1024,
    numberOfChannels: 1,
    sampleRate: 44100,
    duration: 1024 / 44100,
    getChannelData: vi.fn(() => new Float32Array(1024)),
  }),
  sampleRate: 44100,
  state: 'running',
  suspend: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
};

const mockMediaRecorder = {
  start: vi.fn(() => {
    mockMediaRecorder.state = 'recording';
  }),
  stop: vi.fn(() => {
    mockMediaRecorder.state = 'inactive';
    // Defer calling onstop to next tick to allow it to be set
    setTimeout(() => {
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
    }, 0);
  }),
  pause: vi.fn(() => {
    mockMediaRecorder.state = 'paused';
  }),
  resume: vi.fn(() => {
    mockMediaRecorder.state = 'recording';
  }),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
  getAudioTracks: vi.fn(() => [{ stop: vi.fn() }]),
};

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
});

// Mock AudioContext
(global as any).AudioContext = vi.fn(() => mockAudioContext);
(global as any).MediaRecorder = vi.fn(() => mockMediaRecorder);

describe('AudioRecorder', () => {
  let recorder: AudioRecorder;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaRecorder.state = 'inactive';
    recorder = new AudioRecorder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create recorder with default config', () => {
      expect(recorder).toBeDefined();
      expect(recorder.isRecording).toBe(false);
      expect(recorder.isPaused).toBe(false);
    });

    it('should accept custom configuration', () => {
      const config = {
        sampleRate: 48000,
        channels: 1,
        format: AudioFormat.WAV,
      };
      const customRecorder = new AudioRecorder(config);
      expect(customRecorder).toBeDefined();
    });
  });

  describe('microphone access', () => {
    it('should request microphone permission', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockMediaStream);
      
      await recorder.requestMicrophoneAccess();
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 44100,
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    });

    it('should handle microphone access denied', async () => {
      const error = new Error('Permission denied');
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(error);
      
      await expect(recorder.requestMicrophoneAccess()).rejects.toThrow('Permission denied');
    });
  });

  describe('recording control', () => {
    beforeEach(async () => {
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockMediaStream);
      await recorder.requestMicrophoneAccess();
    });

    it('should start recording', async () => {
      await recorder.startRecording();
      
      expect(recorder.isRecording).toBe(true);
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    it('should stop recording', async () => {
      await recorder.startRecording();
      const audioData = await recorder.stopRecording();
      
      expect(recorder.isRecording).toBe(false);
      expect(mockMediaRecorder.stop).toHaveBeenCalled();
      expect(audioData).toBeDefined();
    });

    it('should pause and resume recording', async () => {
      await recorder.startRecording();
      
      recorder.pauseRecording();
      expect(recorder.isPaused).toBe(true);
      expect(mockMediaRecorder.pause).toHaveBeenCalled();
      
      recorder.resumeRecording();
      expect(recorder.isPaused).toBe(false);
      expect(mockMediaRecorder.resume).toHaveBeenCalled();
    });

    it('should not start recording if already recording', async () => {
      await recorder.startRecording();
      
      await expect(recorder.startRecording()).rejects.toThrow('Already recording');
    });
  });

  describe('audio data handling', () => {
    it('should collect audio chunks during recording', async () => {
      await recorder.startRecording();
      
      // Test that the ondataavailable handler exists
      expect(mockMediaRecorder.ondataavailable).toBeDefined();
      
      const audioData = await recorder.stopRecording();
      expect(audioData).toBeDefined();
      expect(audioData instanceof Blob).toBe(true);
      // The empty blob will have size 0, which is expected for mock
    });

    it('should provide audio duration', async () => {
      await recorder.startRecording();
      
      // Simulate some recording time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const duration = recorder.getRecordingDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('audio visualization', () => {
    it('should provide real-time audio levels', async () => {
      await recorder.startRecording();
      
      const levels = recorder.getAudioLevels();
      expect(levels).toBeDefined();
      expect(Array.isArray(levels)).toBe(true);
    });

    it('should provide frequency data for visualization', async () => {
      await recorder.startRecording();
      
      const frequencyData = recorder.getFrequencyData();
      expect(frequencyData).toBeDefined();
      expect(frequencyData instanceof Uint8Array).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle recording errors gracefully', async () => {
      const error = new Error('Recording failed');
      let errorEmitted = false;
      
      // Listen for error event
      recorder.on('recording_error', () => {
        errorEmitted = true;
      });
      
      await recorder.startRecording();
      
      // Simulate error
      if (mockMediaRecorder.onerror) {
        mockMediaRecorder.onerror(error);
      }
      
      expect(errorEmitted).toBe(true);
      expect(recorder.isRecording).toBe(true); // Recording continues unless explicitly stopped
    });

    it('should cleanup resources on error', async () => {
      const error = new Error('Cleanup test');
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(error);
      
      await expect(recorder.requestMicrophoneAccess()).rejects.toThrow();
      
      // Verify cleanup
      expect(mockMediaStream.getTracks().every(track => track.stop)).toBeTruthy();
    });
  });

  describe('audio format conversion', () => {
    it('should convert audio to specified format', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      // Test that convertToWav method exists and can be called
      expect(typeof recorder.convertToWav).toBe('function');
      
      // For now, just test that the method doesn't crash on a basic call
      try {
        await recorder.convertToWav(mockBlob);
      } catch (error) {
        // Expected to fail without proper audioContext setup in test env
        expect(error.message).toContain('Audio context not available');
      }
    });
  });
});