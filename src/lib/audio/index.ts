// Core audio functionality exports
export * from './types';
export * from './recording';
export * from './whisper';
export * from './tts';
export * from './visualization';
export * from './vad';
export * from './playback';

// Main classes
export { AudioRecorder } from './recording';
export { WhisperService } from './whisper';
export { TTSService } from './tts';
export { AudioVisualizer } from './visualization';
export { VoiceActivityDetector, AdvancedVAD } from './vad';
export { AudioPlaybackManager, AudioPlaylist } from './playback';

// Utility functions
export { 
  transcribeAudio, 
  transcribeAudioBatch,
  getOptimalTranscriptionOptions,
  estimateTranscriptionCost,
  validateTranscriptionResult 
} from './whisper';

export { 
  synthesizeSpeech, 
  synthesizeSpeechBatch,
  getOptimalTTSOptions,
  estimateSynthesisCost,
  createSSML 
} from './tts';

export { 
  getSupportedAudioFormats, 
  getBrowserAudioSupport, 
  compressAudio 
} from './recording';

export { 
  createAudioVisualizer,
  getOptimalVisualizationConfig,
  analyzeAudioCharacteristics,
  createVisualizationTheme 
} from './visualization';

export { 
  createVAD,
  getOptimalVADConfig,
  calibrateVAD 
} from './vad';

export { 
  createAudioPlayer,
  createAudioPlaylist,
  playAudio,
  getAudioDuration 
} from './playback';

// Browser compatibility check
export function checkAudioSupport() {
  return {
    recording: getBrowserAudioSupport(),
    playback: {
      htmlAudio: !!window.Audio,
      webAudio: !!(window.AudioContext || (window as any).webkitAudioContext),
      mediaSource: !!window.MediaSource,
    },
    formats: getSupportedAudioFormats(),
  };
}

// Audio context singleton for sharing across components
let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

export function closeSharedAudioContext(): void {
  if (sharedAudioContext) {
    sharedAudioContext.close();
    sharedAudioContext = null;
  }
}

// Audio error handling
export function handleAudioError(error: any): string {
  if (error.name === 'NotAllowedError') {
    return 'Microphone access denied. Please allow microphone permissions.';
  } else if (error.name === 'NotFoundError') {
    return 'No microphone found. Please connect a microphone.';
  } else if (error.name === 'NotSupportedError') {
    return 'Audio recording not supported in this browser.';
  } else if (error.name === 'AbortError') {
    return 'Audio operation was aborted.';
  } else if (error.name === 'NetworkError') {
    return 'Network error occurred during audio processing.';
  } else {
    return error.message || 'An unknown audio error occurred.';
  }
}

// Performance monitoring
export class AudioPerformanceMonitor {
  private metrics: {
    recordingLatency: number[];
    transcriptionLatency: number[];
    synthesisLatency: number[];
    playbackLatency: number[];
  } = {
    recordingLatency: [],
    transcriptionLatency: [],
    synthesisLatency: [],
    playbackLatency: [],
  };

  public recordMetric(type: keyof typeof this.metrics, latency: number): void {
    this.metrics[type].push(latency);
    
    // Keep only recent metrics
    if (this.metrics[type].length > 100) {
      this.metrics[type].shift();
    }
  }

  public getAverageLatency(type: keyof typeof this.metrics): number {
    const values = this.metrics[type];
    if (values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  public getMetricsSummary() {
    return {
      recording: {
        average: this.getAverageLatency('recordingLatency'),
        count: this.metrics.recordingLatency.length,
      },
      transcription: {
        average: this.getAverageLatency('transcriptionLatency'),
        count: this.metrics.transcriptionLatency.length,
      },
      synthesis: {
        average: this.getAverageLatency('synthesisLatency'),
        count: this.metrics.synthesisLatency.length,
      },
      playback: {
        average: this.getAverageLatency('playbackLatency'),
        count: this.metrics.playbackLatency.length,
      },
    };
  }

  public reset(): void {
    this.metrics = {
      recordingLatency: [],
      transcriptionLatency: [],
      synthesisLatency: [],
      playbackLatency: [],
    };
  }
}

// Global performance monitor instance
export const audioPerformanceMonitor = new AudioPerformanceMonitor();

// Audio format conversion utilities
export async function convertAudioFormat(
  audioBlob: Blob, 
  targetFormat: 'wav' | 'mp3' | 'ogg'
): Promise<Blob> {
  // This is a simplified implementation
  // In production, you'd use a proper audio encoding library
  
  const audioContext = getSharedAudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  if (targetFormat === 'wav') {
    const recorder = new AudioRecorder();
    return await recorder.convertToWav(audioBlob);
  }
  
  // For other formats, would need proper encoding
  return audioBlob;
}

// Audio quality analysis
export async function analyzeAudioQuality(audioBlob: Blob): Promise<{
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  dynamicRange: number;
  clippingDetected: boolean;
  noiseLevel: number;
  quality: 'low' | 'medium' | 'high';
}> {
  const audioContext = getSharedAudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Analyze audio characteristics
  const channelData = audioBuffer.getChannelData(0);
  
  // Calculate dynamic range
  let min = 1, max = -1;
  for (let i = 0; i < channelData.length; i++) {
    min = Math.min(min, channelData[i]);
    max = Math.max(max, channelData[i]);
  }
  const dynamicRange = max - min;
  
  // Detect clipping
  const clippingDetected = channelData.some(sample => Math.abs(sample) > 0.99);
  
  // Estimate noise level (simplified)
  const sortedSamples = [...channelData].sort((a, b) => Math.abs(a) - Math.abs(b));
  const noiseLevel = Math.abs(sortedSamples[Math.floor(sortedSamples.length * 0.1)]);
  
  // Estimate bitrate
  const estimatedBitrate = (audioBlob.size * 8) / audioBuffer.duration;
  
  // Quality assessment
  let quality: 'low' | 'medium' | 'high' = 'medium';
  if (audioBuffer.sampleRate >= 44100 && estimatedBitrate > 200000 && !clippingDetected) {
    quality = 'high';
  } else if (audioBuffer.sampleRate < 22050 || estimatedBitrate < 100000 || clippingDetected) {
    quality = 'low';
  }
  
  return {
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    bitrate: estimatedBitrate,
    dynamicRange,
    clippingDetected,
    noiseLevel,
    quality,
  };
}

// Audio enhancement utilities
export async function enhanceAudioQuality(
  audioBlob: Blob,
  options: {
    denoise?: boolean;
    normalize?: boolean;
    compress?: boolean;
    enhanceVoice?: boolean;
  } = {}
): Promise<Blob> {
  const audioContext = getSharedAudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  let currentNode: AudioNode = source;
  
  // Apply enhancements
  if (options.denoise) {
    const highpass = offlineContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;
    currentNode.connect(highpass);
    currentNode = highpass;
  }
  
  if (options.enhanceVoice) {
    const bandpass = offlineContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 0.7;
    currentNode.connect(bandpass);
    currentNode = bandpass;
  }
  
  if (options.compress) {
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.1;
    currentNode.connect(compressor);
    currentNode = compressor;
  }
  
  currentNode.connect(offlineContext.destination);
  
  source.start();
  const enhancedBuffer = await offlineContext.startRendering();
  
  // Convert back to blob
  const recorder = new AudioRecorder();
  const enhancedBlob = await recorder.convertToWav(
    new Blob([enhancedBuffer], { type: 'audio/wav' })
  );
  
  return enhancedBlob;
}

// Default export for convenience
export default {
  AudioRecorder,
  WhisperService,
  TTSService,
  AudioVisualizer,
  VoiceActivityDetector,
  AudioPlaybackManager,
  checkAudioSupport,
  getSharedAudioContext,
  audioPerformanceMonitor,
};