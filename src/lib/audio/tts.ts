import { openai } from '../openai/client';
import { 
  TTSOptions, 
  TTSVoice, 
  TTSSpeed, 
  SynthesisError 
} from './types';

export class TTSService {
  private cache: Map<string, { blob: Blob; timestamp: number }> = new Map();
  private readonly DEFAULT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  
  constructor() {}

  public async synthesize(
    text: string, 
    options: TTSOptions = {}
  ): Promise<Blob> {
    this.validateInput(text);
    
    // Validate SSML if enabled
    if (options.ssml) {
      this.validateSSML(text);
    }
    
    // Check cache first
    if (options.cache !== false) {
      const cacheKey = this.getCacheKey(text, options);
      const cached = this.getCachedResult(cacheKey, options.cacheDuration);
      if (cached) return cached;
    }

    try {
      const response = await openai.audio.speech.create({
        model: options.model || 'tts-1',
        voice: options.voice || TTSVoice.ALLOY,
        input: text,
        response_format: options.format || 'mp3',
        speed: options.speed || TTSSpeed.NORMAL,
      });

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { 
        type: this.getMimeType(options.format || 'mp3') 
      });

      // Cache result if enabled
      if (options.cache !== false) {
        const cacheKey = this.getCacheKey(text, options);
        this.setCachedResult(cacheKey, blob, options.cacheDuration);
      }

      return blob;
      
    } catch (error) {
      throw new SynthesisError(`Speech synthesis failed: ${error.message}`);
    }
  }

  public async synthesizeBatch(
    texts: string[], 
    options: TTSOptions = {}
  ): Promise<(Blob | { error: string })[]> {
    const results = await Promise.allSettled(
      texts.map(text => this.synthesize(text, options))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { error: result.reason.message };
      }
    });
  }

  public async synthesizeStream(
    textStream: ReadableStream<string>,
    options: TTSOptions = {}
  ): Promise<Blob> {
    try {
      // Read all text from stream
      const reader = textStream.getReader();
      const chunks: string[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const fullText = chunks.join('');
      return await this.synthesize(fullText, options);
      
    } catch (error) {
      throw new SynthesisError(`Stream synthesis failed: ${error.message}`);
    }
  }

  public getAvailableVoices(): TTSVoice[] {
    return Object.values(TTSVoice);
  }

  public recommendVoice(text: string): TTSVoice {
    // Analyze text to recommend appropriate voice
    const lowerText = text.toLowerCase();
    
    // Technical or formal content
    if (lowerText.includes('api') || lowerText.includes('documentation') || 
        lowerText.includes('technical') || lowerText.includes('specification')) {
      return TTSVoice.ECHO; // More formal, clear voice
    }
    
    // Casual or conversational content
    if (lowerText.includes('hey') || lowerText.includes('hi') || 
        lowerText.includes('thanks') || lowerText.includes('please')) {
      return TTSVoice.NOVA; // Friendly, approachable voice
    }
    
    // Narrative or storytelling content
    if (lowerText.includes('story') || lowerText.includes('once upon') || 
        lowerText.includes('imagine') || text.length > 500) {
      return TTSVoice.FABLE; // Expressive, narrative voice
    }
    
    // Professional or business content
    if (lowerText.includes('meeting') || lowerText.includes('report') || 
        lowerText.includes('analysis') || lowerText.includes('strategy')) {
      return TTSVoice.ONYX; // Professional, authoritative voice
    }
    
    // Default to balanced voice
    return TTSVoice.ALLOY;
  }

  public optimizeForUseCase(text: string, useCase: string): TTSOptions {
    const options: TTSOptions = {};
    
    switch (useCase) {
      case 'podcast':
        options.voice = TTSVoice.NOVA;
        options.speed = TTSSpeed.SLOW;
        options.model = 'tts-1-hd';
        options.format = 'mp3';
        break;
        
      case 'conversation':
        options.voice = TTSVoice.ALLOY;
        options.speed = TTSSpeed.FAST;
        options.model = 'tts-1';
        options.format = 'opus';
        break;
        
      case 'narration':
        options.voice = TTSVoice.FABLE;
        options.speed = TTSSpeed.NORMAL;
        options.model = 'tts-1-hd';
        options.format = 'mp3';
        break;
        
      case 'announcement':
        options.voice = TTSVoice.ECHO;
        options.speed = TTSSpeed.SLOW;
        options.model = 'tts-1';
        options.format = 'mp3';
        break;
        
      default:
        options.voice = this.recommendVoice(text);
        options.speed = TTSSpeed.NORMAL;
        options.model = 'tts-1';
        options.format = 'mp3';
    }
    
    return options;
  }

  private validateInput(text: string): void {
    if (!text || text.trim().length === 0) {
      throw new SynthesisError('Empty text input');
    }
    
    // OpenAI TTS has a 4096 character limit
    if (text.length > 4096) {
      throw new SynthesisError('Text too long (max 4096 characters)');
    }
    
    // Check for potentially problematic content
    const problematicPatterns = [
      /<script/i,
      /javascript:/i,
      /<iframe/i,
    ];
    
    if (problematicPatterns.some(pattern => pattern.test(text))) {
      throw new SynthesisError('Text contains potentially unsafe content');
    }
  }

  private validateSSML(ssml: string): void {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(ssml, 'application/xml');
      
      if (doc.querySelector('parsererror')) {
        throw new SynthesisError('Invalid SSML markup');
      }
      
      // Check for required speak tag
      if (!doc.querySelector('speak')) {
        throw new SynthesisError('SSML must contain a speak tag');
      }
      
    } catch (error) {
      throw new SynthesisError(`SSML validation failed: ${error.message}`);
    }
  }

  private getCacheKey(text: string, options: TTSOptions): string {
    const key = JSON.stringify({ text, options });
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  private getCachedResult(key: string, duration?: number): Blob | null {
    const cached = this.cache.get(key);
    if (cached) {
      const expireDuration = duration || this.DEFAULT_CACHE_DURATION;
      if (Date.now() - cached.timestamp < expireDuration) {
        return cached.blob;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  private setCachedResult(key: string, blob: Blob, duration?: number): void {
    this.cache.set(key, { 
      blob, 
      timestamp: Date.now() 
    });
    
    // Clean up old cache entries
    if (this.cache.size > 50) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.cache.delete(oldest[0]);
    }
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      aac: 'audio/aac',
      flac: 'audio/flac',
    };
    
    return mimeTypes[format] || 'audio/mpeg';
  }

  public async processSSML(ssml: string, options: TTSOptions = {}): Promise<Blob> {
    this.validateSSML(ssml);
    
    try {
      return await this.synthesize(ssml, { ...options, ssml: true });
    } catch (error) {
      throw new SynthesisError(`SSML processing failed: ${error.message}`);
    }
  }

  public splitLongText(text: string, maxChunkSize: number = 4000): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }
    
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      const sentenceWithPunc = trimmedSentence + '.';
      
      if (currentChunk.length + sentenceWithPunc.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single sentence is too long, split by words
        if (sentenceWithPunc.length > maxChunkSize) {
          const words = sentenceWithPunc.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > maxChunkSize) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = '';
              }
            }
            wordChunk += word + ' ';
          }
          
          if (wordChunk.trim()) {
            currentChunk = wordChunk;
          }
        } else {
          currentChunk = sentenceWithPunc;
        }
      } else {
        currentChunk += sentenceWithPunc + ' ';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  public async synthesizeLongText(
    text: string, 
    options: TTSOptions = {}
  ): Promise<Blob[]> {
    const chunks = this.splitLongText(text);
    const audioChunks: Blob[] = [];
    
    for (const chunk of chunks) {
      const audio = await this.synthesize(chunk, options);
      audioChunks.push(audio);
    }
    
    return audioChunks;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public getCacheStats(): { size: number; totalSize: number } {
    let totalSize = 0;
    for (const [, { blob }] of this.cache) {
      totalSize += blob.size;
    }
    
    return {
      size: this.cache.size,
      totalSize,
    };
  }
}

// Utility functions for speech synthesis
export async function synthesizeSpeech(
  text: string, 
  options?: TTSOptions
): Promise<Blob> {
  const tts = new TTSService();
  return await tts.synthesize(text, options);
}

export async function synthesizeSpeechBatch(
  texts: string[], 
  options?: TTSOptions
): Promise<(Blob | { error: string })[]> {
  const tts = new TTSService();
  return await tts.synthesizeBatch(texts, options);
}

export function getOptimalTTSOptions(
  text: string, 
  useCase: 'conversation' | 'podcast' | 'narration' | 'announcement' = 'conversation'
): TTSOptions {
  const tts = new TTSService();
  return tts.optimizeForUseCase(text, useCase);
}

export function estimateSynthesisCost(text: string): number {
  // OpenAI TTS pricing: $15 per 1M characters
  return (text.length / 1000000) * 15;
}

export function createSSML(
  text: string, 
  options: {
    voice?: TTSVoice;
    rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
    pitch?: 'x-low' | 'low' | 'medium' | 'high' | 'x-high';
    emphasis?: 'strong' | 'moderate' | 'reduced';
    pauses?: { [key: string]: string }; // word -> pause duration
  } = {}
): string {
  let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`;
  
  if (options.voice) {
    ssml += `<voice name="${options.voice}">`;
  }
  
  let processedText = text;
  
  // Add pauses
  if (options.pauses) {
    for (const [word, duration] of Object.entries(options.pauses)) {
      processedText = processedText.replace(
        new RegExp(`\\b${word}\\b`, 'gi'),
        `${word}<break time="${duration}"/>`
      );
    }
  }
  
  // Add prosody
  if (options.rate || options.pitch) {
    const prosodyAttrs: string[] = [];
    if (options.rate) prosodyAttrs.push(`rate="${options.rate}"`);
    if (options.pitch) prosodyAttrs.push(`pitch="${options.pitch}"`);
    
    processedText = `<prosody ${prosodyAttrs.join(' ')}>${processedText}</prosody>`;
  }
  
  // Add emphasis
  if (options.emphasis) {
    processedText = `<emphasis level="${options.emphasis}">${processedText}</emphasis>`;
  }
  
  ssml += processedText;
  
  if (options.voice) {
    ssml += '</voice>';
  }
  
  ssml += '</speak>';
  
  return ssml;
}