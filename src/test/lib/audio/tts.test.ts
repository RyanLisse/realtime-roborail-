import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TTSService } from '../../../lib/audio/tts';
import { TTSVoice, TTSSpeed } from '../../../lib/audio/types';

// Mock OpenAI client
vi.mock('../../../lib/openai/client', () => ({
  openai: {
    audio: {
      speech: {
        create: vi.fn(),
      },
    },
  },
}));

const mockOpenAIClient = {
  audio: {
    speech: {
      create: vi.fn(),
    },
  },
};

describe('TTSService', () => {
  let ttsService: TTSService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Set up mock
    const { openai } = await import('../../../lib/openai/client');
    mockOpenAIClient.audio.speech.create = openai.audio.speech.create;
    ttsService = new TTSService();
  });

  describe('speech synthesis', () => {
    it('should synthesize text to speech', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      const result = await ttsService.synthesize('Hello world');

      expect(result).toBeInstanceOf(Blob);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1',
        voice: TTSVoice.ALLOY,
        input: 'Hello world',
        response_format: 'mp3',
        speed: TTSSpeed.NORMAL,
      });
    });

    it('should handle different voice options', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      await ttsService.synthesize('Hello world', {
        voice: TTSVoice.NOVA,
        speed: TTSSpeed.SLOW,
      });

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1',
        voice: TTSVoice.NOVA,
        input: 'Hello world',
        response_format: 'mp3',
        speed: TTSSpeed.SLOW,
      });
    });

    it('should handle high-quality model', async () => {
      const mockAudioBuffer = new ArrayBuffer(2048);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      await ttsService.synthesize('Hello world', {
        model: 'tts-1-hd',
        voice: TTSVoice.ECHO,
      });

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1-hd',
        voice: TTSVoice.ECHO,
        input: 'Hello world',
        response_format: 'mp3',
        speed: TTSSpeed.NORMAL,
      });
    });
  });

  describe('batch synthesis', () => {
    it('should synthesize multiple texts', async () => {
      const texts = ['Hello', 'How are you?', 'Goodbye'];
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      const results = await ttsService.synthesizeBatch(texts);

      expect(results).toHaveLength(3);
      expect(results.every(result => result instanceof Blob)).toBe(true);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch synthesis', async () => {
      const texts = ['Hello', 'Error text', 'Goodbye'];
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Synthesis failed'))
        .mockResolvedValueOnce(mockResponse);

      const results = await ttsService.synthesizeBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0]).toBeInstanceOf(Blob);
      expect(results[1]).toEqual({ error: 'Speech synthesis failed: Synthesis failed' });
      expect(results[2]).toBeInstanceOf(Blob);
    });
  });

  describe('streaming synthesis', () => {
    it('should handle streaming text synthesis', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Hello ');
          controller.enqueue('world!');
          controller.close();
        },
      });

      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      const result = await ttsService.synthesizeStream(mockStream);

      expect(result).toBeInstanceOf(Blob);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1',
        voice: TTSVoice.ALLOY,
        input: 'Hello world!',
        response_format: 'mp3',
        speed: TTSSpeed.NORMAL,
      });
    });
  });

  describe('SSML support', () => {
    it('should handle SSML markup', async () => {
      const ssmlText = '<speak>Hello <break time="1s"/> world!</speak>';
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      const result = await ttsService.synthesize(ssmlText, { ssml: true });

      expect(result).toBeInstanceOf(Blob);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1',
        voice: TTSVoice.ALLOY,
        input: ssmlText,
        response_format: 'mp3',
        speed: TTSSpeed.NORMAL,
      });
    });

    it('should validate SSML markup', async () => {
      const invalidSSML = '<speak>Unclosed tag';

      await expect(ttsService.synthesize(invalidSSML, { ssml: true }))
        .rejects.toThrow('Invalid SSML markup');
    });
  });

  describe('audio format handling', () => {
    it('should support different audio formats', async () => {
      // Clear cache to ensure fresh test
      ttsService.clearCache();
      
      const formats = ['mp3', 'opus', 'aac', 'flac'];
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      for (let i = 0; i < formats.length; i++) {
        const format = formats[i];
        await ttsService.synthesize(`Test ${format}`, { format, cache: false });
        
        expect(mockOpenAIClient.audio.speech.create).toHaveBeenNthCalledWith(i + 1, {
          model: 'tts-1',
          voice: TTSVoice.ALLOY,
          input: `Test ${format}`,
          response_format: format,
          speed: TTSSpeed.NORMAL,
        });
      }
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API quota exceeded');
      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockRejectedValue(apiError);

      await expect(ttsService.synthesize('Hello world')).rejects.toThrow('API quota exceeded');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockRejectedValue(networkError);

      await expect(ttsService.synthesize('Hello world')).rejects.toThrow('Network error');
    });

    it('should validate text input', async () => {
      const longText = 'a'.repeat(5000); // Exceeds typical limit

      await expect(ttsService.synthesize(longText)).rejects.toThrow('Text too long');
    });

    it('should handle empty text input', async () => {
      await expect(ttsService.synthesize('')).rejects.toThrow('Empty text input');
    });
  });

  describe('voice selection', () => {
    it('should provide available voices', () => {
      const voices = ttsService.getAvailableVoices();
      
      expect(voices).toContain(TTSVoice.ALLOY);
      expect(voices).toContain(TTSVoice.ECHO);
      expect(voices).toContain(TTSVoice.FABLE);
      expect(voices).toContain(TTSVoice.ONYX);
      expect(voices).toContain(TTSVoice.NOVA);
      expect(voices).toContain(TTSVoice.SHIMMER);
    });

    it('should recommend voice based on content', () => {
      const technicalText = 'API documentation and SDK integration';
      const casualText = 'Hey there, how are you doing?';
      
      const techVoice = ttsService.recommendVoice(technicalText);
      const casualVoice = ttsService.recommendVoice(casualText);
      
      expect(techVoice).toBeDefined();
      expect(casualVoice).toBeDefined();
      // Technical content might prefer more formal voices
      expect([TTSVoice.ECHO, TTSVoice.ONYX]).toContain(techVoice);
    });
  });

  describe('audio optimization', () => {
    it('should optimize audio for different use cases', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      // Test podcast optimization
      await ttsService.synthesize('Podcast content', { 
        optimize: 'podcast',
        voice: TTSVoice.NOVA,
        speed: TTSSpeed.SLOW,
      });

      // Test conversation optimization
      await ttsService.synthesize('Quick response', { 
        optimize: 'conversation',
        voice: TTSVoice.ALLOY,
        speed: TTSSpeed.FAST,
      });

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('caching', () => {
    it('should cache synthesized audio', async () => {
      const text = 'Cached audio test';
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      // First call
      const result1 = await ttsService.synthesize(text, { cache: true });
      
      // Second call should use cache
      const result2 = await ttsService.synthesize(text, { cache: true });

      expect(result1).toBeInstanceOf(Blob);
      expect(result2).toBeInstanceOf(Blob);
      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(1);
    });

    it('should respect cache expiration', async () => {
      const text = 'Expired cache test';
      const mockAudioBuffer = new ArrayBuffer(1024);
      const mockResponse = {
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.speech.create).mockResolvedValue(mockResponse);

      // First call with short cache duration
      await ttsService.synthesize(text, { cache: true, cacheDuration: 100 });
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call should hit API again
      await ttsService.synthesize(text, { cache: true, cacheDuration: 100 });

      expect(mockOpenAIClient.audio.speech.create).toHaveBeenCalledTimes(2);
    });
  });
});