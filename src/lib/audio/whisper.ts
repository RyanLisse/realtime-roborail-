import { openai } from '../openai/client';
import { 
  WhisperOptions, 
  WhisperResult, 
  WhisperSegment, 
  TranscriptionError 
} from './types';

export class WhisperService {
  private cache: Map<string, { result: WhisperResult; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  constructor() {}

  public async transcribe(
    audioBlob: Blob, 
    options: WhisperOptions = {}
  ): Promise<WhisperResult> {
    this.validateAudioBlob(audioBlob);
    
    const cacheKey = await this.getCacheKey(audioBlob, options);
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      // Preprocess audio if needed
      let processedBlob = audioBlob;
      if (options.compress) {
        processedBlob = await this.compressAudio(audioBlob);
      }
      if (options.enhance) {
        processedBlob = await this.enhanceAudio(processedBlob);
      }

      // Convert blob to file
      const file = new File([processedBlob], 'audio.wav', { 
        type: processedBlob.type || 'audio/wav' 
      });

      const response = await openai.audio.transcriptions.create({
        file,
        model: options.model || 'whisper-1',
        language: options.language,
        prompt: options.prompt,
        response_format: options.responseFormat || 'verbose_json',
        temperature: options.temperature || 0,
      });

      const result: WhisperResult = {
        text: response.text,
        language: response.language || 'en',
        duration: response.duration || 0,
        segments: options.includeSegments ? response.segments?.map(seg => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
          confidence: seg.confidence,
        })) : undefined,
      };

      this.setCachedResult(cacheKey, result);
      return result;
      
    } catch (error) {
      throw new TranscriptionError(`Transcription failed: ${error.message}`);
    }
  }

  public async transcribeBatch(
    audioBlobs: Blob[], 
    options: WhisperOptions = {}
  ): Promise<(WhisperResult | { error: string })[]> {
    const results = await Promise.allSettled(
      audioBlobs.map(blob => this.transcribe(blob, options))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { error: result.reason.message };
      }
    });
  }

  public async transcribeStream(
    audioStream: ReadableStream<Uint8Array>,
    options: WhisperOptions = {}
  ): Promise<WhisperResult> {
    try {
      // Convert stream to blob
      const reader = audioStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const audioData = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }
      
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      
      // Skip validation for stream-converted blobs as they may not have proper MIME types
      // Check cache first if enabled
      if (options.cache !== false) {
        const cacheKey = await this.getCacheKey(audioBlob, options);
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;
      }

      try {
        // Convert blob to file
        const file = new File([audioBlob], 'audio.wav', { 
          type: 'audio/wav' 
        });

        const response = await openai.audio.transcriptions.create({
          file,
          model: options.model || 'whisper-1',
          language: options.language,
          prompt: options.prompt,
          response_format: options.responseFormat || 'verbose_json',
          temperature: options.temperature || 0,
        });

        const result: WhisperResult = {
          text: response.text,
          language: response.language || 'en',
          duration: response.duration || 0,
          segments: options.includeSegments ? response.segments?.map(seg => ({
            start: seg.start,
            end: seg.end,
            text: seg.text,
            confidence: seg.confidence,
          })) : undefined,
        };

        // Cache result if enabled
        if (options.cache !== false) {
          const cacheKey = await this.getCacheKey(audioBlob, options);
          this.setCachedResult(cacheKey, result);
        }
        return result;
        
      } catch (error) {
        throw new TranscriptionError(`Transcription failed: ${error.message}`);
      }
      
    } catch (error) {
      throw new TranscriptionError(`Stream transcription failed: ${error.message}`);
    }
  }

  public async compressAudio(audioBlob: Blob): Promise<Blob> {
    // This is a simplified implementation
    // In a real-world scenario, you'd use a proper audio compression library
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Create audio context for processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create offline context with lower sample rate for compression
      const targetSampleRate = Math.min(audioBuffer.sampleRate, 16000);
      const offlineContext = new OfflineAudioContext(
        1, // Mono
        Math.floor(audioBuffer.length * (targetSampleRate / audioBuffer.sampleRate)),
        targetSampleRate
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
      
      // Convert back to blob (simplified)
      const compressedBlob = new Blob([this.audioBufferToWav(compressedBuffer)], {
        type: 'audio/wav'
      });
      
      await audioContext.close();
      return compressedBlob;
      
    } catch (error) {
      throw new TranscriptionError(`Audio compression failed: ${error.message}`);
    }
  }

  public async enhanceAudio(audioBlob: Blob): Promise<Blob> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create offline context for enhancement
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Apply noise reduction (simplified)
      const highpass = offlineContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 100; // Remove low-frequency noise
      
      const lowpass = offlineContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 8000; // Remove high-frequency noise
      
      // Apply dynamic range compression for voice
      const compressor = offlineContext.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.001;
      compressor.release.value = 0.1;
      
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(compressor);
      compressor.connect(offlineContext.destination);
      
      source.start();
      const enhancedBuffer = await offlineContext.startRendering();
      
      const enhancedBlob = new Blob([this.audioBufferToWav(enhancedBuffer)], {
        type: 'audio/wav'
      });
      
      await audioContext.close();
      return enhancedBlob;
      
    } catch (error) {
      throw new TranscriptionError(`Audio enhancement failed: ${error.message}`);
    }
  }

  private validateAudioBlob(audioBlob: Blob): void {
    if (!audioBlob || audioBlob.size === 0) {
      throw new TranscriptionError('Invalid or empty audio blob');
    }
    
    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.some(type => audioBlob.type.includes(type))) {
      throw new TranscriptionError('Invalid audio format');
    }
    
    // Check file size (OpenAI has 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBlob.size > maxSize) {
      throw new TranscriptionError('Audio file too large (max 25MB)');
    }
  }

  private async getCacheKey(audioBlob: Blob, options: WhisperOptions): Promise<string> {
    const optionsString = JSON.stringify(options);
    const blobData = await audioBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', 
      new TextEncoder().encode(optionsString + blobData.byteLength)
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private getCachedResult(key: string): WhisperResult | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedResult(key: string, result: WhisperResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
    
    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
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

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }
}

// Utility functions for transcription
export async function transcribeAudio(
  audioBlob: Blob, 
  options?: WhisperOptions
): Promise<WhisperResult> {
  const whisper = new WhisperService();
  return await whisper.transcribe(audioBlob, options);
}

export async function transcribeAudioBatch(
  audioBlobs: Blob[], 
  options?: WhisperOptions
): Promise<(WhisperResult | { error: string })[]> {
  const whisper = new WhisperService();
  return await whisper.transcribeBatch(audioBlobs, options);
}

export function getOptimalTranscriptionOptions(
  audioBlob: Blob, 
  language?: string
): WhisperOptions {
  const options: WhisperOptions = {
    model: 'whisper-1',
    responseFormat: 'verbose_json',
    temperature: 0,
    includeSegments: true,
  };

  if (language) {
    options.language = language;
  }

  // Auto-enhance if audio is likely to be noisy
  if (audioBlob.size < 5 * 1024 * 1024) { // < 5MB
    options.enhance = true;
  }

  // Compress if audio is large
  if (audioBlob.size > 15 * 1024 * 1024) { // > 15MB
    options.compress = true;
  }

  return options;
}

export function estimateTranscriptionCost(audioBlob: Blob): number {
  // OpenAI Whisper pricing: $0.006 per minute
  const estimatedDurationMinutes = audioBlob.size / (1024 * 1024 * 0.5); // Rough estimate
  return estimatedDurationMinutes * 0.006;
}

export function validateTranscriptionResult(result: WhisperResult): boolean {
  return !!(
    result.text &&
    result.language &&
    result.duration >= 0 &&
    (!result.segments || result.segments.every(seg => 
      seg.start >= 0 && seg.end >= seg.start && seg.text
    ))
  );
}