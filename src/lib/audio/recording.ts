import { 
  AudioRecorderConfig, 
  AudioFormat, 
  AudioRecordingResult, 
  RecordingError,
  RecordingEvent,
  AudioEventEmitter,
  AudioEventListener 
} from './types';

export class AudioRecorder implements AudioEventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private pausedTime: number = 0;
  private eventListeners: Map<string, AudioEventListener<any>[]> = new Map();
  
  private config: Required<AudioRecorderConfig> = {
    sampleRate: 44100,
    channels: 2,
    format: AudioFormat.WAV,
    bufferSize: 4096,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  constructor(config?: AudioRecorderConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.checkBrowserSupport();
  }

  private checkBrowserSupport(): void {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new RecordingError('getUserMedia is not supported in this browser');
    }
    
    if (!window.MediaRecorder) {
      throw new RecordingError('MediaRecorder is not supported in this browser');
    }
    
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      throw new RecordingError('Web Audio API is not supported in this browser');
    }
  }

  public async requestMicrophoneAccess(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio context for analysis
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.bufferSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect media stream to analyser
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
    } catch (error) {
      throw new RecordingError(`Failed to access microphone: ${error.message}`);
    }
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new RecordingError('Already recording');
    }

    if (!this.mediaStream) {
      await this.requestMicrophoneAccess();
    }

    try {
      this.audioChunks = [];
      this.startTime = Date.now();
      this.pausedTime = 0;

      // Determine MIME type based on format
      const mimeType = this.getMimeType();
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream!, {
        mimeType,
        audioBitsPerSecond: this.getBitrate(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.emit('recording_stopped', {
          type: 'recording_stopped',
          timestamp: Date.now(),
          duration: this.getRecordingDuration(),
        } as RecordingEvent);
      };

      this.mediaRecorder.onerror = (error) => {
        this.emit('recording_error', {
          type: 'recording_error',
          timestamp: Date.now(),
          data: error,
        } as RecordingEvent);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      
      this.emit('recording_started', {
        type: 'recording_started',
        timestamp: Date.now(),
      } as RecordingEvent);
      
    } catch (error) {
      throw new RecordingError(`Failed to start recording: ${error.message}`);
    }
  }

  public async stopRecording(): Promise<Blob> {
    if (!this.isRecording) {
      throw new RecordingError('Not currently recording');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new RecordingError('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, {
          type: this.getMimeType(),
        });
        
        this.audioChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public pauseRecording(): void {
    if (!this.isRecording || this.isPaused) {
      throw new RecordingError('Cannot pause recording');
    }

    this.mediaRecorder?.pause();
    this.pausedTime = Date.now();
    
    this.emit('recording_paused', {
      type: 'recording_paused',
      timestamp: Date.now(),
      duration: this.getRecordingDuration(),
    } as RecordingEvent);
  }

  public resumeRecording(): void {
    if (!this.isPaused) {
      throw new RecordingError('Cannot resume recording');
    }

    this.mediaRecorder?.resume();
    this.startTime += Date.now() - this.pausedTime;
    this.pausedTime = 0;
    
    this.emit('recording_resumed', {
      type: 'recording_resumed',
      timestamp: Date.now(),
    } as RecordingEvent);
  }

  public getRecordingDuration(): number {
    if (!this.startTime) return 0;
    
    const endTime = this.isPaused ? this.pausedTime : Date.now();
    return Math.max(0, endTime - this.startTime);
  }

  public getAudioLevels(): number[] {
    if (!this.analyser) return [];
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return Array.from(dataArray).map(value => value / 255);
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array();
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return dataArray;
  }

  public getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array();
    
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    
    return dataArray;
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

  public async convertToWav(audioBlob: Blob): Promise<Blob> {
    if (!this.audioContext) {
      throw new RecordingError('Audio context not available');
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      throw new RecordingError(`Failed to convert to WAV: ${error.message}`);
    }
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // PCM data
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return buffer;
  }

  private getMimeType(): string {
    const formats = {
      [AudioFormat.WAV]: 'audio/wav',
      [AudioFormat.MP3]: 'audio/mpeg',
      [AudioFormat.OGG]: 'audio/ogg',
      [AudioFormat.WEBM]: 'audio/webm',
      [AudioFormat.M4A]: 'audio/mp4',
    };
    
    return formats[this.config.format] || 'audio/wav';
  }

  private getBitrate(): number {
    const bitrateMap = {
      [AudioFormat.WAV]: 1411000, // 44.1kHz * 16bit * 2ch
      [AudioFormat.MP3]: 320000,
      [AudioFormat.OGG]: 256000,
      [AudioFormat.WEBM]: 256000,
      [AudioFormat.M4A]: 256000,
    };
    
    return bitrateMap[this.config.format] || 256000;
  }

  public get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  public get isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  public cleanup(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.audioChunks = [];
    this.eventListeners.clear();
  }

  // Event emitter implementation
  public on<T extends RecordingEvent>(event: string, listener: AudioEventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  public off<T extends RecordingEvent>(event: string, listener: AudioEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  public emit<T extends RecordingEvent>(event: string, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}

// Utility functions
export function getSupportedAudioFormats(): AudioFormat[] {
  const formats: AudioFormat[] = [];
  const testRecorder = (mimeType: string) => {
    try {
      return MediaRecorder.isTypeSupported(mimeType);
    } catch {
      return false;
    }
  };

  if (testRecorder('audio/wav')) formats.push(AudioFormat.WAV);
  if (testRecorder('audio/webm')) formats.push(AudioFormat.WEBM);
  if (testRecorder('audio/ogg')) formats.push(AudioFormat.OGG);
  if (testRecorder('audio/mp4')) formats.push(AudioFormat.M4A);
  if (testRecorder('audio/mpeg')) formats.push(AudioFormat.MP3);

  return formats;
}

export function getBrowserAudioSupport() {
  return {
    webAudio: !!(window.AudioContext || (window as any).webkitAudioContext),
    mediaRecorder: !!window.MediaRecorder,
    mediaStream: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    audioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    supportedFormats: getSupportedAudioFormats(),
  };
}

export async function compressAudio(audioBlob: Blob, targetBitrate: number = 128000): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create offline context for compression
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Apply compression
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    source.connect(compressor);
    compressor.connect(offlineContext.destination);
    
    source.start();
    const compressedBuffer = await offlineContext.startRendering();
    
    // Convert back to blob (simplified - would need proper encoding)
    const recorder = new AudioRecorder();
    return recorder.convertToWav(audioBlob);
    
  } finally {
    await audioContext.close();
  }
}