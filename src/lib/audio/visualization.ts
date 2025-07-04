import { 
  AudioVisualizationConfig, 
  FrequencyBands, 
  AudioPeaks, 
  VisualizationOptions 
} from './types';

export class AudioVisualizer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private isActive: boolean = false;
  private levelMonitoringId: number | null = null;
  
  private config: Required<AudioVisualizationConfig> = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    minDecibels: -100,
    maxDecibels: -30,
    refreshRate: 60,
  };

  constructor(config?: AudioVisualizationConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
      this.analyser.minDecibels = this.config.minDecibels;
      this.analyser.maxDecibels = this.config.maxDecibels;
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (error) {
      throw new Error(`AudioContext not supported: ${error.message}`);
    }
  }

  public async connectToMediaStream(mediaStream: MediaStream): Promise<void> {
    if (!mediaStream) {
      throw new Error('Invalid media stream');
    }
    
    if (!this.audioContext || !this.analyser) {
      throw new Error('Audio context not initialized');
    }
    
    try {
      const source = this.audioContext.createMediaStreamSource(mediaStream);
      source.connect(this.analyser);
    } catch (error) {
      throw new Error(`Failed to connect media stream: ${error.message}`);
    }
  }

  public async connectToAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    if (!audioElement) {
      throw new Error('Invalid audio element');
    }
    
    if (!this.audioContext || !this.analyser) {
      throw new Error('Audio context not initialized');
    }
    
    try {
      // Ensure CORS is set for cross-origin audio
      audioElement.crossOrigin = 'anonymous';
      
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyser);
      source.connect(this.audioContext.destination);
    } catch (error) {
      throw new Error(`Failed to connect audio element: ${error.message}`);
    }
  }

  public startVisualization(
    callback?: (data: { frequency: Uint8Array; waveform: Uint8Array }) => void,
    options?: VisualizationOptions
  ): void {
    if (this.isActive) return;
    
    this.isActive = true;
    const throttleMs = options?.throttle || (1000 / this.config.refreshRate);
    let lastUpdate = 0;
    
    const animate = () => {
      if (!this.isActive) return;
      
      const now = Date.now();
      if (now - lastUpdate >= throttleMs) {
        if (callback) {
          callback({
            frequency: this.getFrequencyData(options?.resolution),
            waveform: this.getWaveformData(),
          });
        }
        lastUpdate = now;
      }
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  public stopVisualization(): void {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public getFrequencyData(resolution?: number): Uint8Array {
    if (!this.analyser || !this.dataArray) {
      return new Uint8Array();
    }
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    if (resolution && resolution < this.dataArray.length) {
      // Downsample for performance
      const downsampled = new Uint8Array(resolution);
      const step = this.dataArray.length / resolution;
      
      for (let i = 0; i < resolution; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let sum = 0;
        
        for (let j = start; j < end; j++) {
          sum += this.dataArray[j];
        }
        
        downsampled[i] = sum / (end - start);
      }
      
      return downsampled;
    }
    
    return new Uint8Array(this.dataArray);
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array();
    }
    
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    
    return dataArray;
  }

  public getFrequencyBands(): FrequencyBands {
    const frequencyData = this.getFrequencyData();
    if (frequencyData.length === 0) {
      return { low: 0, mid: 0, high: 0 };
    }
    
    const length = frequencyData.length;
    const lowEnd = Math.floor(length * 0.1);
    const midEnd = Math.floor(length * 0.5);
    
    let low = 0, mid = 0, high = 0;
    
    // Low frequencies (0-10%)
    for (let i = 0; i < lowEnd; i++) {
      low += frequencyData[i];
    }
    low = (low / lowEnd) / 255;
    
    // Mid frequencies (10-50%)
    for (let i = lowEnd; i < midEnd; i++) {
      mid += frequencyData[i];
    }
    mid = (mid / (midEnd - lowEnd)) / 255;
    
    // High frequencies (50-100%)
    for (let i = midEnd; i < length; i++) {
      high += frequencyData[i];
    }
    high = (high / (length - midEnd)) / 255;
    
    return { low, mid, high };
  }

  public getAudioSpectrum(): number[] {
    const frequencyData = this.getFrequencyData();
    return Array.from(frequencyData).map(value => value / 255);
  }

  public getRMSLevel(): number {
    const waveform = this.getWaveformData();
    if (waveform.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < waveform.length; i++) {
      const sample = (waveform[i] - 128) / 128;
      sum += sample * sample;
    }
    
    return Math.sqrt(sum / waveform.length);
  }

  public detectPeaks(threshold: number = 0.7): AudioPeaks {
    const waveform = this.getWaveformData();
    if (waveform.length === 0) {
      return { positive: 0, negative: 0 };
    }
    
    let positiveExcursions = 0;
    let negativeExcursions = 0;
    const thresholdPositive = 128 + (threshold * 127);
    const thresholdNegative = 128 - (threshold * 127);
    
    for (let i = 0; i < waveform.length; i++) {
      if (waveform[i] > thresholdPositive) {
        positiveExcursions++;
      } else if (waveform[i] < thresholdNegative) {
        negativeExcursions++;
      }
    }
    
    return {
      positive: positiveExcursions / waveform.length,
      negative: negativeExcursions / waveform.length,
    };
  }

  public detectSilence(threshold: number = 0.01): boolean {
    const rms = this.getRMSLevel();
    return rms < threshold;
  }

  public detectAudioActivity(threshold: number = 0.02): boolean {
    const rms = this.getRMSLevel();
    return rms > threshold;
  }

  public startLevelMonitoring(
    callback: (level: number) => void,
    interval: number = 100
  ): void {
    if (this.levelMonitoringId) return;
    
    this.levelMonitoringId = window.setInterval(() => {
      const level = this.getRMSLevel();
      callback(level);
    }, interval);
  }

  public stopLevelMonitoring(): void {
    if (this.levelMonitoringId) {
      clearInterval(this.levelMonitoringId);
      this.levelMonitoringId = null;
    }
  }

  // Canvas rendering methods
  public renderFrequencyBars(
    canvas: HTMLCanvasElement,
    options?: { 
      color?: string; 
      backgroundColor?: string; 
      barWidth?: number;
      gap?: number; 
    }
  ): void {
    if (!canvas) {
      throw new Error('Invalid canvas element');
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const frequencyData = this.getFrequencyData();
    if (frequencyData.length === 0) return;
    
    const { width, height } = canvas;
    const barCount = Math.min(frequencyData.length, Math.floor(width / (options?.barWidth || 4)));
    const barWidth = options?.barWidth || Math.floor(width / barCount);
    const gap = options?.gap || 1;
    
    // Clear canvas
    ctx.fillStyle = options?.backgroundColor || '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw bars
    ctx.fillStyle = options?.color || '#00ff00';
    
    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * frequencyData.length);
      const barHeight = (frequencyData[dataIndex] / 255) * height;
      const x = i * (barWidth + gap);
      const y = height - barHeight;
      
      ctx.fillRect(x, y, barWidth - gap, barHeight);
    }
  }

  public renderWaveform(
    canvas: HTMLCanvasElement,
    options?: { 
      color?: string; 
      backgroundColor?: string; 
      lineWidth?: number; 
    }
  ): void {
    if (!canvas) {
      throw new Error('Invalid canvas element');
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const waveformData = this.getWaveformData();
    if (waveformData.length === 0) return;
    
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = options?.backgroundColor || '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw waveform
    ctx.strokeStyle = options?.color || '#00ff00';
    ctx.lineWidth = options?.lineWidth || 2;
    ctx.beginPath();
    
    const sliceWidth = width / waveformData.length;
    let x = 0;
    
    for (let i = 0; i < waveformData.length; i++) {
      const v = waveformData[i] / 128.0;
      const y = v * height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  }

  public renderCircularVisualization(
    canvas: HTMLCanvasElement,
    options?: { 
      color?: string; 
      backgroundColor?: string; 
      radius?: number; 
    }
  ): void {
    if (!canvas) {
      throw new Error('Invalid canvas element');
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const frequencyData = this.getFrequencyData();
    if (frequencyData.length === 0) return;
    
    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = options?.radius || Math.min(centerX, centerY) * 0.8;
    
    // Clear canvas
    ctx.fillStyle = options?.backgroundColor || '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw circular visualization
    ctx.strokeStyle = options?.color || '#00ff00';
    ctx.lineWidth = 2;
    
    const angleStep = (Math.PI * 2) / frequencyData.length;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const angle = i * angleStep;
      const amplitude = frequencyData[i] / 255;
      const lineLength = amplitude * radius * 0.5;
      
      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;
      const endX = centerX + Math.cos(angle) * (radius + lineLength);
      const endY = centerY + Math.sin(angle) * (radius + lineLength);
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  public get isVisualizationActive(): boolean {
    return this.isActive;
  }

  public cleanup(): void {
    this.stopVisualization();
    this.stopLevelMonitoring();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
  }
}

// Utility functions for audio visualization
export function createAudioVisualizer(config?: AudioVisualizationConfig): AudioVisualizer {
  return new AudioVisualizer(config);
}

export function getOptimalVisualizationConfig(
  canvasSize: { width: number; height: number },
  useCase: 'waveform' | 'spectrum' | 'bars' | 'circular' = 'spectrum'
): AudioVisualizationConfig {
  const config: AudioVisualizationConfig = {};
  
  switch (useCase) {
    case 'waveform':
      config.fftSize = 2048;
      config.smoothingTimeConstant = 0.3;
      config.refreshRate = 60;
      break;
      
    case 'spectrum':
      config.fftSize = 1024;
      config.smoothingTimeConstant = 0.8;
      config.refreshRate = 30;
      break;
      
    case 'bars':
      config.fftSize = 512;
      config.smoothingTimeConstant = 0.6;
      config.refreshRate = 60;
      break;
      
    case 'circular':
      config.fftSize = 256;
      config.smoothingTimeConstant = 0.8;
      config.refreshRate = 30;
      break;
  }
  
  // Adjust based on canvas size for performance
  if (canvasSize.width * canvasSize.height > 500000) { // Large canvas
    config.refreshRate = Math.min(config.refreshRate || 30, 30);
    config.fftSize = Math.min(config.fftSize || 1024, 1024);
  }
  
  return config;
}

export function analyzeAudioCharacteristics(
  visualizer: AudioVisualizer
): {
  volume: number;
  bassLevel: number;
  trebleLevel: number;
  hasVoice: boolean;
  isSilent: boolean;
} {
  const rms = visualizer.getRMSLevel();
  const bands = visualizer.getFrequencyBands();
  const spectrum = visualizer.getAudioSpectrum();
  
  // Voice detection (simplified heuristic)
  const voiceFreqRange = spectrum.slice(
    Math.floor(spectrum.length * 0.1), 
    Math.floor(spectrum.length * 0.4)
  );
  const voiceEnergy = voiceFreqRange.reduce((sum, val) => sum + val, 0) / voiceFreqRange.length;
  const hasVoice = voiceEnergy > 0.1 && bands.mid > 0.15;
  
  return {
    volume: rms,
    bassLevel: bands.low,
    trebleLevel: bands.high,
    hasVoice,
    isSilent: visualizer.detectSilence(),
  };
}

export function createVisualizationTheme(
  name: 'neon' | 'classic' | 'minimal' | 'dark'
): {
  color: string;
  backgroundColor: string;
  lineWidth: number;
  barWidth?: number;
  gap?: number;
} {
  const themes = {
    neon: {
      color: '#00ff41',
      backgroundColor: '#000000',
      lineWidth: 2,
      barWidth: 3,
      gap: 1,
    },
    classic: {
      color: '#ffa500',
      backgroundColor: '#1a1a1a',
      lineWidth: 1,
      barWidth: 4,
      gap: 2,
    },
    minimal: {
      color: '#666666',
      backgroundColor: '#ffffff',
      lineWidth: 1,
      barWidth: 2,
      gap: 1,
    },
    dark: {
      color: '#4a9eff',
      backgroundColor: '#0f0f0f',
      lineWidth: 2,
      barWidth: 3,
      gap: 1,
    },
  };
  
  return themes[name];
}