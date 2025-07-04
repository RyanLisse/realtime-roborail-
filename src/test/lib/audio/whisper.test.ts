import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhisperService } from '../../../lib/audio/whisper';
import { AudioFormat } from '../../../lib/audio/types';

// Mock OpenAI client
vi.mock('../../../lib/openai/client', () => ({
  openai: {
    audio: {
      transcriptions: {
        create: vi.fn(),
      },
    },
  },
}));

const mockOpenAIClient = {
  audio: {
    transcriptions: {
      create: vi.fn(),
    },
  },
};

describe('WhisperService', () => {
  let whisperService: WhisperService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Set up mock
    const { openai } = await import('../../../lib/openai/client');
    mockOpenAIClient.audio.transcriptions.create = openai.audio.transcriptions.create;
    whisperService = new WhisperService();
    // Clear cache between tests
    (whisperService as any).cache.clear();
  });

  describe('transcription', () => {
    it('should transcribe audio blob to text', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const mockTranscription = {
        text: 'Hello, how are you today?',
        language: 'en',
        duration: 2.5,
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(mockAudioBlob);

      expect(result).toEqual(mockTranscription);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith({
        file: expect.any(File),
        model: 'whisper-1',
        language: undefined,
        response_format: 'verbose_json',
        temperature: 0,
      });
    });

    it('should handle transcription with language hint', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const mockTranscription = {
        text: 'Bonjour, comment allez-vous?',
        language: 'fr',
        duration: 3.0,
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(mockAudioBlob, { language: 'fr' });

      expect(result).toEqual(mockTranscription);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith({
        file: expect.any(File),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        temperature: 0,
      });
    });

    it('should handle transcription with custom prompt', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const mockTranscription = {
        text: 'Technical documentation about APIs',
        language: 'en',
        duration: 5.0,
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(mockAudioBlob, {
        prompt: 'This is a technical discussion about APIs and software development.',
      });

      expect(result).toEqual(mockTranscription);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledWith({
        file: expect.any(File),
        model: 'whisper-1',
        language: undefined,
        response_format: 'verbose_json',
        temperature: 0,
        prompt: 'This is a technical discussion about APIs and software development.',
      });
    });
  });

  describe('batch transcription', () => {
    it('should transcribe multiple audio files', async () => {
      const audioBlobs = [
        new Blob(['audio 1'], { type: 'audio/wav' }),
        new Blob(['audio 2 longer'], { type: 'audio/wav' }),
      ];

      const mockTranscriptions = [
        { text: 'First audio', language: 'en', duration: 2.0 },
        { text: 'Second audio', language: 'en', duration: 3.0 },
      ];

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create)
        .mockResolvedValueOnce(mockTranscriptions[0])
        .mockResolvedValueOnce(mockTranscriptions[1]);

      const results = await whisperService.transcribeBatch(audioBlobs);

      expect(results).toEqual([
        { text: 'First audio', language: 'en', duration: 2.0, segments: undefined },
        { text: 'Second audio', language: 'en', duration: 3.0, segments: undefined },
      ]);
      expect(mockOpenAIClient.audio.transcriptions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch transcription', async () => {
      // Clear cache to ensure fresh test
      whisperService.clearCache();
      
      const audioBlobs = [
        new Blob(['unique audio data one with lots of content'], { type: 'audio/wav' }),
        new Blob(['completely different audio data two with different length'], { type: 'audio/wav' }),
      ];

      const mockTranscription = { text: 'First audio', language: 'en', duration: 2.0 };
      const mockError = new Error('Transcription failed');

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create)
        .mockResolvedValueOnce(mockTranscription)
        .mockRejectedValueOnce(mockError);

      const results = await whisperService.transcribeBatch(audioBlobs, { cache: false });

      expect(results).toHaveLength(2);
      
      // Check that we have one success and one error, regardless of order
      const hasSuccess = results.some(r => 'text' in r && r.text === 'First audio');
      const hasError = results.some(r => 'error' in r && r.error === 'Transcription failed: Transcription failed');
      
      expect(hasSuccess).toBe(true);
      expect(hasError).toBe(true);
    });
  });

  describe('streaming transcription', () => {
    it('should handle streaming audio transcription', async () => {
      // Clear cache to ensure fresh test
      whisperService.clearCache();
      
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      const mockTranscription = {
        text: 'Streaming audio transcription',
        language: 'en',
        duration: 4.0,
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribeStream(mockStream, { cache: false });

      expect(result).toEqual({
        text: 'Streaming audio transcription',
        language: 'en',
        duration: 4.0,
        segments: undefined,
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const apiError = new Error('API quota exceeded');

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockRejectedValue(apiError);

      await expect(whisperService.transcribe(mockAudioBlob)).rejects.toThrow('Transcription failed: API quota exceeded');
    });

    it('should handle network errors', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const networkError = new Error('Network error');

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockRejectedValue(networkError);

      await expect(whisperService.transcribe(mockAudioBlob)).rejects.toThrow('Transcription failed: Network error');
    });

    it('should validate audio format', async () => {
      const invalidBlob = new Blob(['not audio'], { type: 'text/plain' });

      await expect(whisperService.transcribe(invalidBlob)).rejects.toThrow('Invalid audio format');
    });
  });

  describe('audio preprocessing', () => {
    it('should compress audio before transcription', async () => {
      const largeAudioBlob = new Blob(['large audio data'], { type: 'audio/wav' });
      const compressedBlob = new Blob(['compressed'], { type: 'audio/mp3' });

      const mockTranscription = {
        text: 'Compressed audio transcription',
        language: 'en',
        duration: 3.0,
      };

      // Mock compression
      vi.spyOn(whisperService, 'compressAudio').mockResolvedValue(compressedBlob);
      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(largeAudioBlob, { compress: true });

      expect(whisperService.compressAudio).toHaveBeenCalledWith(largeAudioBlob);
      expect(result).toEqual(mockTranscription);
    });

    it('should enhance audio quality before transcription', async () => {
      const noisyAudioBlob = new Blob(['noisy audio'], { type: 'audio/wav' });
      const enhancedBlob = new Blob(['enhanced'], { type: 'audio/wav' });

      const mockTranscription = {
        text: 'Enhanced audio transcription',
        language: 'en',
        duration: 2.8,
      };

      // Mock enhancement
      vi.spyOn(whisperService, 'enhanceAudio').mockResolvedValue(enhancedBlob);
      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(noisyAudioBlob, { enhance: true });

      expect(whisperService.enhanceAudio).toHaveBeenCalledWith(noisyAudioBlob);
      expect(result).toEqual(mockTranscription);
    });
  });

  describe('confidence scoring', () => {
    it('should provide confidence scores for transcriptions', async () => {
      const mockAudioBlob = new Blob(['audio data'], { type: 'audio/wav' });
      const mockTranscription = {
        text: 'Hello world',
        language: 'en',
        duration: 1.5,
        segments: [
          { start: 0, end: 0.8, text: 'Hello', confidence: 0.98 },
          { start: 0.8, end: 1.5, text: 'world', confidence: 0.95 },
        ],
      };

      const { openai } = await import('../../../lib/openai/client');
      vi.mocked(openai.audio.transcriptions.create).mockResolvedValue(mockTranscription);

      const result = await whisperService.transcribe(mockAudioBlob, { includeSegments: true });

      expect(result.segments).toBeDefined();
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].confidence).toBeGreaterThan(0.9);
    });
  });
});