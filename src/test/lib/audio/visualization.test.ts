import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioVisualizer } from '../../../lib/audio/visualization';

// Mock Web Audio API
const mockAnalyser = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  getByteFrequencyData: vi.fn(),
  getByteTimeDomainData: vi.fn(),
  getFloatFrequencyData: vi.fn(),
  getFloatTimeDomainData: vi.fn(),
  minDecibels: -100,
  maxDecibels: -30,
  smoothingTimeConstant: 0.8,
  connect: vi.fn(),
};

const mockMediaStreamSource = {
  connect: vi.fn(),
};

const mockGain = {
  connect: vi.fn(),
};

const mockAudioContext = {
  createAnalyser: vi.fn(() => mockAnalyser),
  createMediaStreamSource: vi.fn(() => mockMediaStreamSource),
  createGain: vi.fn(() => mockGain),
  createMediaElementSource: vi.fn(() => mockMediaStreamSource),
  sampleRate: 44100,
  state: 'running',
  destination: {},
  close: vi.fn(),
};

const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
};

// Mock AudioContext
(global as any).AudioContext = vi.fn(() => mockAudioContext);
(global as any).window = {
  AudioContext: vi.fn(() => mockAudioContext),
  webkitAudioContext: vi.fn(() => mockAudioContext),
  setInterval: vi.fn((callback, delay) => {
    const id = setTimeout(callback, delay);
    return id;
  }),
  clearInterval: vi.fn((id) => clearTimeout(id)),
  requestAnimationFrame: vi.fn((callback) => {
    const id = setTimeout(callback, 16);
    return id;
  }),
  cancelAnimationFrame: vi.fn((id) => clearTimeout(id)),
};

describe('AudioVisualizer', () => {
  let visualizer: AudioVisualizer;

  beforeEach(() => {
    vi.clearAllMocks();
    visualizer = new AudioVisualizer();
  });

  describe('initialization', () => {
    it('should create visualizer with default config', () => {
      expect(visualizer).toBeDefined();
      expect(visualizer.isVisualizationActive).toBe(false);
    });

    it('should accept custom configuration', () => {
      const config = {
        fftSize: 4096,
        smoothingTimeConstant: 0.9,
        minDecibels: -90,
        maxDecibels: -20,
      };
      const customVisualizer = new AudioVisualizer(config);
      expect(customVisualizer).toBeDefined();
    });
  });

  describe('audio source connection', () => {
    it('should connect to media stream', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should connect to audio element', async () => {
      const mockAudioElement = {
        crossOrigin: 'anonymous',
        src: 'test-audio.mp3',
      } as HTMLAudioElement;

      await visualizer.connectToAudioElement(mockAudioElement);
      
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });
  });

  describe('frequency domain visualization', () => {
    beforeEach(async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
    });

    it('should get frequency data', () => {
      const mockFrequencyData = new Uint8Array(1024);
      mockFrequencyData.fill(128);
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        array.set(mockFrequencyData);
      });

      const frequencyData = visualizer.getFrequencyData();
      
      expect(frequencyData).toBeInstanceOf(Uint8Array);
      expect(frequencyData.length).toBe(1024);
      expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled();
    });

    it('should get frequency bands', () => {
      const mockFrequencyData = new Uint8Array(1024);
      // Simulate frequency data with different levels
      mockFrequencyData.fill(100, 0, 100);   // Low frequencies
      mockFrequencyData.fill(150, 100, 300); // Mid frequencies
      mockFrequencyData.fill(80, 300, 1024); // High frequencies
      
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        array.set(mockFrequencyData);
      });

      const bands = visualizer.getFrequencyBands();
      
      expect(bands).toHaveProperty('low');
      expect(bands).toHaveProperty('mid');
      expect(bands).toHaveProperty('high');
      expect(bands.low).toBeGreaterThan(0);
      expect(bands.mid).toBeGreaterThan(0);
      expect(bands.high).toBeGreaterThan(0);
    });

    it('should calculate audio spectrum', () => {
      const mockFrequencyData = new Uint8Array(1024);
      mockFrequencyData.fill(120);
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        array.set(mockFrequencyData);
      });

      const spectrum = visualizer.getAudioSpectrum();
      
      expect(spectrum).toHaveLength(1024);
      expect(spectrum.every(value => value >= 0 && value <= 1)).toBe(true);
    });
  });

  describe('time domain visualization', () => {
    beforeEach(async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
    });

    it('should get waveform data', () => {
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(128);
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockWaveformData);
      });

      const waveformData = visualizer.getWaveformData();
      
      expect(waveformData).toBeInstanceOf(Uint8Array);
      expect(waveformData.length).toBe(2048);
      expect(mockAnalyser.getByteTimeDomainData).toHaveBeenCalled();
    });

    it('should calculate RMS level', () => {
      const mockWaveformData = new Uint8Array(2048);
      // Simulate varying audio levels
      mockWaveformData.fill(140, 0, 1024);  // Above center
      mockWaveformData.fill(110, 1024, 2048); // Below center
      
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockWaveformData);
      });

      const rmsLevel = visualizer.getRMSLevel();
      
      expect(rmsLevel).toBeGreaterThan(0);
      expect(rmsLevel).toBeLessThanOrEqual(1);
    });

    it('should detect audio peaks', () => {
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(128);
      mockWaveformData[100] = 255; // Strong peak
      mockWaveformData[101] = 254; // Strong peak 
      mockWaveformData[102] = 253; // Strong peak
      mockWaveformData[200] = 0;   // Strong valley
      mockWaveformData[201] = 1;   // Strong valley
      mockWaveformData[202] = 2;   // Strong valley
      
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        for (let i = 0; i < mockWaveformData.length; i++) {
          array[i] = mockWaveformData[i];
        }
      });

      const peaks = visualizer.detectPeaks(0.5); // Lower threshold for testing
      
      expect(peaks).toHaveProperty('positive');
      expect(peaks).toHaveProperty('negative');
      expect(peaks.positive).toBeGreaterThan(0);
      expect(peaks.negative).toBeGreaterThan(0);
    });
  });

  describe('visualization controls', () => {
    it('should start visualization', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      expect(visualizer.isVisualizationActive).toBe(true);
    });

    it('should stop visualization', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      visualizer.stopVisualization();
      
      expect(visualizer.isVisualizationActive).toBe(false);
    });

    it('should handle visualization callback', async () => {
      const mockCallback = vi.fn();
      
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization(mockCallback);
      
      // Simulate animation frame
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('canvas rendering', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;

    beforeEach(() => {
      mockContext = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
      } as any;

      mockCanvas = {
        getContext: vi.fn(() => mockContext),
        width: 800,
        height: 400,
      } as any;
    });

    it('should render frequency bars', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const mockFrequencyData = new Uint8Array(1024);
      mockFrequencyData.fill(120);
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        for (let i = 0; i < Math.min(array.length, mockFrequencyData.length); i++) {
          array[i] = mockFrequencyData[i];
        }
      });

      visualizer.renderFrequencyBars(mockCanvas);
      
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('should render waveform', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(128);
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        for (let i = 0; i < Math.min(array.length, mockWaveformData.length); i++) {
          array[i] = mockWaveformData[i];
        }
      });

      visualizer.renderWaveform(mockCanvas);
      
      expect(mockContext.fillRect).toHaveBeenCalled(); // fillRect is called for background
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('should render circular visualization', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const mockFrequencyData = new Uint8Array(1024);
      mockFrequencyData.fill(120);
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        for (let i = 0; i < Math.min(array.length, mockFrequencyData.length); i++) {
          array[i] = mockFrequencyData[i];
        }
      });

      visualizer.renderCircularVisualization(mockCanvas);
      
      expect(mockContext.fillRect).toHaveBeenCalled(); // fillRect is called for background
      expect(mockContext.beginPath).toHaveBeenCalled();
    });
  });

  describe('audio level monitoring', () => {
    it('should monitor audio levels continuously', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      
      const levelCallback = vi.fn();
      visualizer.startLevelMonitoring(levelCallback);
      
      // Simulate audio level changes
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(150);
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockWaveformData);
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(levelCallback).toHaveBeenCalled();
      visualizer.stopLevelMonitoring();
    });

    it('should detect silence', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(128); // Silence (center value)
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockWaveformData);
      });

      const isSilent = visualizer.detectSilence();
      
      expect(isSilent).toBe(true);
    });

    it('should detect audio activity', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const mockWaveformData = new Uint8Array(2048);
      mockWaveformData.fill(160); // Audio activity
      mockAnalyser.getByteTimeDomainData.mockImplementation((array) => {
        array.set(mockWaveformData);
      });

      const hasActivity = visualizer.detectAudioActivity();
      
      expect(hasActivity).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle audio context creation failure', () => {
      const originalWindow = (global as any).window;
      (global as any).window = {
        ...originalWindow,
        AudioContext: vi.fn(() => {
          throw new Error('AudioContext not supported');
        }),
        webkitAudioContext: vi.fn(() => {
          throw new Error('AudioContext not supported');
        }),
      };

      expect(() => new AudioVisualizer()).toThrow('AudioContext not supported');
      
      // Restore
      (global as any).window = originalWindow;
    });

    it('should handle media stream connection failure', async () => {
      const invalidStream = null;
      
      await expect(visualizer.connectToMediaStream(invalidStream as any))
        .rejects.toThrow('Invalid media stream');
    });

    it('should handle canvas rendering errors', async () => {
      const invalidCanvas = null;
      
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      expect(() => visualizer.renderFrequencyBars(invalidCanvas as any))
        .toThrow('Invalid canvas element');
    });
  });

  describe('performance optimization', () => {
    it('should throttle visualization updates', async () => {
      const callback = vi.fn();
      
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization(callback, { throttle: 100 });
      
      // Multiple rapid calls should be throttled
      await new Promise(resolve => setTimeout(resolve, 50));
      await new Promise(resolve => setTimeout(resolve, 50));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalledTimes(2); // Allow for initial call + one throttled call
    });

    it('should optimize frequency data resolution', async () => {
      await visualizer.connectToMediaStream(mockMediaStream);
      visualizer.startVisualization();
      
      const fullResolution = visualizer.getFrequencyData();
      const reducedResolution = visualizer.getFrequencyData(512);
      
      expect(fullResolution.length).toBe(1024);
      expect(reducedResolution.length).toBe(512);
    });
  });
});