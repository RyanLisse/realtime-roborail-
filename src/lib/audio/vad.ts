import { 
  VADConfig, 
  VADResult, 
  AudioVisualizationConfig 
} from './types';
import { AudioVisualizer } from './visualization';

export class VoiceActivityDetector {
  protected visualizer: AudioVisualizer;
  private isListening: boolean = false;
  private silenceStartTime: number = 0;
  private speechStartTime: number = 0;
  private lastActivityTime: number = 0;
  private monitoringInterval: number | null = null;
  private activityCallback: ((result: VADResult) => void) | null = null;
  
  protected config: Required<VADConfig> = {
    threshold: 0.02,
    minSilenceDuration: 1000, // 1 second
    maxSilenceDuration: 5000, // 5 seconds
    preSpeechPadding: 100,    // 100ms
    postSpeechPadding: 300,   // 300ms
  };

  protected state = {
    isSpeechActive: false,
    confidence: 0,
    silenceDuration: 0,
    speechDuration: 0,
    energyHistory: [] as number[],
    frequencyHistory: [] as number[][],
  };

  constructor(config?: VADConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Initialize visualizer for audio analysis
    this.visualizer = new AudioVisualizer({
      fftSize: 1024,
      smoothingTimeConstant: 0.3,
      refreshRate: 20,
    });
  }

  public async startListening(
    mediaStream: MediaStream,
    callback?: (result: VADResult) => void
  ): Promise<void> {
    if (this.isListening) return;
    
    await this.visualizer.connectToMediaStream(mediaStream);
    this.isListening = true;
    this.activityCallback = callback || null;
    this.lastActivityTime = Date.now();
    
    this.startMonitoring();
  }

  public stopListening(): void {
    if (!this.isListening) return;
    
    this.isListening = false;
    this.activityCallback = null;
    this.stopMonitoring();
    this.resetState();
  }

  public configure(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getCurrentResult(): VADResult {
    return {
      isSpeechActive: this.state.isSpeechActive,
      confidence: this.state.confidence,
      silenceDuration: this.state.silenceDuration,
      speechDuration: this.state.speechDuration,
    };
  }

  private startMonitoring(): void {
    this.monitoringInterval = window.setInterval(() => {
      this.analyzeActivity();
    }, 50); // 50ms intervals for responsive detection
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  protected analyzeActivity(): void {
    if (!this.isListening) return;
    
    const now = Date.now();
    const energy = this.visualizer.getRMSLevel();
    const frequencyBands = this.visualizer.getFrequencyBands();
    const spectrum = this.visualizer.getAudioSpectrum();
    
    // Update history
    this.updateHistory(energy, spectrum);
    
    // Detect speech activity
    const speechDetected = this.detectSpeech(energy, frequencyBands, spectrum);
    const confidence = this.calculateConfidence(energy, frequencyBands, spectrum);
    
    // Update state based on detection
    this.updateState(speechDetected, confidence, now);
    
    // Call callback if provided
    if (this.activityCallback) {
      this.activityCallback(this.getCurrentResult());
    }
  }

  protected detectSpeech(
    energy: number, 
    bands: { low: number; mid: number; high: number }, 
    spectrum: number[]
  ): boolean {
    // Basic energy threshold
    if (energy < this.config.threshold) {
      return false;
    }
    
    // Voice frequency analysis
    const voiceFreqRange = spectrum.slice(
      Math.floor(spectrum.length * 0.1),  // ~430Hz at 44.1kHz
      Math.floor(spectrum.length * 0.4)   // ~3.5kHz at 44.1kHz
    );
    
    const voiceEnergy = voiceFreqRange.reduce((sum, val) => sum + val, 0) / voiceFreqRange.length;
    
    // Check if energy is concentrated in voice frequencies
    const voiceRatio = voiceEnergy / (energy + 0.001);
    const hasVoiceCharacteristics = voiceRatio > 0.3 && bands.mid > 0.1;
    
    // Temporal consistency check
    const recentEnergy = this.state.energyHistory.slice(-5);
    const isConsistent = recentEnergy.length >= 3 && 
      recentEnergy.every(e => e > this.config.threshold * 0.5);
    
    return hasVoiceCharacteristics && isConsistent;
  }

  protected calculateConfidence(
    energy: number, 
    bands: { low: number; mid: number; high: number }, 
    spectrum: number[]
  ): number {
    let confidence = 0;
    
    // Energy-based confidence
    const energyRatio = Math.min(energy / 0.1, 1);
    confidence += energyRatio * 0.3;
    
    // Voice frequency confidence
    const voiceFreqRange = spectrum.slice(
      Math.floor(spectrum.length * 0.1),
      Math.floor(spectrum.length * 0.4)
    );
    const voiceEnergy = voiceFreqRange.reduce((sum, val) => sum + val, 0) / voiceFreqRange.length;
    confidence += Math.min(voiceEnergy / 0.2, 1) * 0.4;
    
    // Frequency distribution confidence
    const midBandStrength = Math.min(bands.mid / 0.2, 1);
    confidence += midBandStrength * 0.2;
    
    // Temporal consistency confidence
    const recentEnergy = this.state.energyHistory.slice(-10);
    if (recentEnergy.length >= 5) {
      const variance = this.calculateVariance(recentEnergy);
      const consistencyScore = Math.max(0, 1 - variance * 10);
      confidence += consistencyScore * 0.1;
    }
    
    return Math.min(confidence, 1);
  }

  protected updateHistory(energy: number, spectrum: number[]): void {
    this.state.energyHistory.push(energy);
    this.state.frequencyHistory.push([...spectrum]);
    
    // Keep only recent history
    if (this.state.energyHistory.length > 100) {
      this.state.energyHistory.shift();
      this.state.frequencyHistory.shift();
    }
  }

  private updateState(speechDetected: boolean, confidence: number, timestamp: number): void {
    const wasActive = this.state.isSpeechActive;
    
    if (speechDetected && !wasActive) {
      // Speech started
      this.state.isSpeechActive = true;
      this.speechStartTime = timestamp;
      this.silenceStartTime = 0;
      this.lastActivityTime = timestamp;
    } else if (!speechDetected && wasActive) {
      // Potential speech end, start silence timer
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = timestamp;
      }
    } else if (speechDetected && wasActive) {
      // Continuing speech
      this.lastActivityTime = timestamp;
      this.silenceStartTime = 0;
    }
    
    // Update durations
    if (this.state.isSpeechActive) {
      if (this.silenceStartTime > 0) {
        // Currently in potential silence
        this.state.silenceDuration = timestamp - this.silenceStartTime;
        
        // Check if silence has exceeded threshold
        if (this.state.silenceDuration >= this.config.minSilenceDuration) {
          this.state.isSpeechActive = false;
          this.state.speechDuration = this.silenceStartTime - this.speechStartTime;
          this.silenceStartTime = timestamp;
        }
      } else {
        // Active speech
        this.state.speechDuration = timestamp - this.speechStartTime;
        this.state.silenceDuration = 0;
      }
    } else {
      // Currently silent
      if (this.silenceStartTime > 0) {
        this.state.silenceDuration = timestamp - this.silenceStartTime;
      }
      this.state.speechDuration = 0;
    }
    
    this.state.confidence = confidence;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return variance;
  }

  private resetState(): void {
    this.state = {
      isSpeechActive: false,
      confidence: 0,
      silenceDuration: 0,
      speechDuration: 0,
      energyHistory: [],
      frequencyHistory: [],
    };
    
    this.silenceStartTime = 0;
    this.speechStartTime = 0;
    this.lastActivityTime = 0;
  }

  public getAnalytics(): {
    averageEnergy: number;
    energyVariance: number;
    speechPercentage: number;
    totalSpeechTime: number;
    totalSilenceTime: number;
  } {
    const energyHistory = this.state.energyHistory;
    
    if (energyHistory.length === 0) {
      return {
        averageEnergy: 0,
        energyVariance: 0,
        speechPercentage: 0,
        totalSpeechTime: 0,
        totalSilenceTime: 0,
      };
    }
    
    const averageEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / energyHistory.length;
    const energyVariance = this.calculateVariance(energyHistory);
    
    // Count frames above speech threshold
    const speechFrames = energyHistory.filter(energy => energy > this.config.threshold).length;
    const speechPercentage = speechFrames / energyHistory.length;
    
    return {
      averageEnergy,
      energyVariance,
      speechPercentage,
      totalSpeechTime: this.state.speechDuration,
      totalSilenceTime: this.state.silenceDuration,
    };
  }

  public cleanup(): void {
    this.stopListening();
    this.visualizer.cleanup();
  }
}

// Advanced VAD with machine learning features
export class AdvancedVAD extends VoiceActivityDetector {
  private spectralFeatures: {
    spectralCentroid: number[];
    spectralRolloff: number[];
    zeroCrossingRate: number[];
    mfcc: number[][];
  } = {
    spectralCentroid: [],
    spectralRolloff: [],
    zeroCrossingRate: [],
    mfcc: [],
  };

  protected detectSpeech(
    energy: number, 
    bands: { low: number; mid: number; high: number }, 
    spectrum: number[]
  ): boolean {
    // Extract advanced features
    const spectralCentroid = this.calculateSpectralCentroid(spectrum);
    const spectralRolloff = this.calculateSpectralRolloff(spectrum);
    const zeroCrossingRate = this.calculateZeroCrossingRate();
    
    // Update feature history
    this.updateSpectralFeatures(spectralCentroid, spectralRolloff, zeroCrossingRate);
    
    // Multi-feature classification
    const features = {
      energy,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      voiceRatio: bands.mid / (bands.low + bands.high + 0.001),
      energyRatio: energy / Math.max(...this.state.energyHistory.slice(-20)),
    };
    
    return this.classifySpeech(features);
  }

  private calculateSpectralCentroid(spectrum: number[]): number {
    let weightedSum = 0;
    let sum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      sum += spectrum[i];
    }
    
    return sum > 0 ? weightedSum / sum : 0;
  }

  private calculateSpectralRolloff(spectrum: number[], threshold: number = 0.85): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const targetEnergy = totalEnergy * threshold;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i];
      if (cumulativeEnergy >= targetEnergy) {
        return i / spectrum.length;
      }
    }
    
    return 1;
  }

  private calculateZeroCrossingRate(): number {
    const waveform = this.visualizer.getWaveformData();
    if (waveform.length < 2) return 0;
    
    let crossings = 0;
    for (let i = 1; i < waveform.length; i++) {
      if ((waveform[i] >= 128) !== (waveform[i - 1] >= 128)) {
        crossings++;
      }
    }
    
    return crossings / (waveform.length - 1);
  }

  private updateSpectralFeatures(
    spectralCentroid: number, 
    spectralRolloff: number, 
    zeroCrossingRate: number
  ): void {
    this.spectralFeatures.spectralCentroid.push(spectralCentroid);
    this.spectralFeatures.spectralRolloff.push(spectralRolloff);
    this.spectralFeatures.zeroCrossingRate.push(zeroCrossingRate);
    
    // Keep recent history
    const maxHistory = 50;
    if (this.spectralFeatures.spectralCentroid.length > maxHistory) {
      this.spectralFeatures.spectralCentroid.shift();
      this.spectralFeatures.spectralRolloff.shift();
      this.spectralFeatures.zeroCrossingRate.shift();
    }
  }

  private classifySpeech(features: {
    energy: number;
    spectralCentroid: number;
    spectralRolloff: number;
    zeroCrossingRate: number;
    voiceRatio: number;
    energyRatio: number;
  }): boolean {
    // Rule-based classification with multiple features
    const rules = [
      features.energy > this.config.threshold,
      features.spectralCentroid > 0.1 && features.spectralCentroid < 0.6,
      features.spectralRolloff > 0.2 && features.spectralRolloff < 0.8,
      features.zeroCrossingRate > 0.05 && features.zeroCrossingRate < 0.3,
      features.voiceRatio > 0.5,
      features.energyRatio > 0.3,
    ];
    
    // Require majority of rules to pass
    const passedRules = rules.filter(Boolean).length;
    return passedRules >= Math.ceil(rules.length * 0.6);
  }
}

// Utility functions
export function createVAD(config?: VADConfig, advanced: boolean = false): VoiceActivityDetector {
  return advanced ? new AdvancedVAD(config) : new VoiceActivityDetector(config);
}

export function getOptimalVADConfig(useCase: 'conversation' | 'dictation' | 'command' = 'conversation'): VADConfig {
  const configs = {
    conversation: {
      threshold: 0.015,
      minSilenceDuration: 800,
      maxSilenceDuration: 3000,
      preSpeechPadding: 150,
      postSpeechPadding: 400,
    },
    dictation: {
      threshold: 0.02,
      minSilenceDuration: 1200,
      maxSilenceDuration: 5000,
      preSpeechPadding: 100,
      postSpeechPadding: 500,
    },
    command: {
      threshold: 0.025,
      minSilenceDuration: 500,
      maxSilenceDuration: 2000,
      preSpeechPadding: 50,
      postSpeechPadding: 200,
    },
  };
  
  return configs[useCase];
}

export function calibrateVAD(
  vad: VoiceActivityDetector,
  calibrationAudio: { silent: Blob[]; speech: Blob[] }
): Promise<VADConfig> {
  // This would analyze the provided audio samples to determine optimal thresholds
  // For now, return a basic configuration
  return Promise.resolve({
    threshold: 0.02,
    minSilenceDuration: 1000,
    maxSilenceDuration: 5000,
    preSpeechPadding: 100,
    postSpeechPadding: 300,
  });
}