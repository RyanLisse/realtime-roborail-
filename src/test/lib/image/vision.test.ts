import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  analyzeImage, 
  analyzeEquipmentImage, 
  extractTextFromImage,
  analyzeImageBatch 
} from '../../../lib/image/vision';
import { createMockImageFile } from '../../../lib/image/validation';
import { VisionAnalysisResult } from '../../../lib/image/types';

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.mock('../../../lib/openai/client', () => ({
  getOpenAIClient: () => mockOpenAI
}));

describe('GPT-4 Vision Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeImage', () => {
    it('should analyze a basic image', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'A test image showing equipment',
              confidence: 0.9
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await analyzeImage(mockFile);
      
      expect(result.description).toBe('A test image showing equipment');
      expect(result.confidence).toBe(0.9);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-vision-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'image_url'
              })
            ])
          })
        ]),
        max_tokens: 1000
      });
    });

    it('should handle analysis with custom prompt', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const customPrompt = 'Analyze this machinery';
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Custom analysis result',
              confidence: 0.8
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await analyzeImage(mockFile, customPrompt);
      
      expect(result.description).toBe('Custom analysis result');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: expect.stringContaining(customPrompt)
                })
              ])
            })
          ])
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      
      await expect(analyzeImage(mockFile)).rejects.toThrow('API Error');
    });
  });

  describe('analyzeEquipmentImage', () => {
    it('should analyze equipment condition', async () => {
      const mockFile = createMockImageFile('equipment.jpg', 'image/jpeg', 1024 * 1024);
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Industrial pump in good condition',
              equipmentType: 'pump',
              condition: 'good',
              issues: ['minor wear on housing'],
              recommendations: ['Schedule maintenance check'],
              confidence: 0.85
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await analyzeEquipmentImage(mockFile);
      
      expect(result.equipmentType).toBe('pump');
      expect(result.condition).toBe('good');
      expect(result.issues).toContain('minor wear on housing');
      expect(result.recommendations).toContain('Schedule maintenance check');
      expect(result.confidence).toBe(0.85);
    });

    it('should identify equipment issues', async () => {
      const mockFile = createMockImageFile('damaged.jpg', 'image/jpeg', 1024 * 1024);
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Damaged motor with visible corrosion',
              equipmentType: 'motor',
              condition: 'poor',
              issues: ['corrosion on casing', 'damaged wiring'],
              recommendations: ['Immediate replacement required', 'Safety inspection'],
              confidence: 0.9
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await analyzeEquipmentImage(mockFile);
      
      expect(result.condition).toBe('poor');
      expect(result.issues).toHaveLength(2);
      expect(result.recommendations).toContain('Immediate replacement required');
    });
  });

  describe('extractTextFromImage', () => {
    it('should extract text from technical diagrams', async () => {
      const mockFile = createMockImageFile('diagram.jpg', 'image/jpeg', 1024 * 1024);
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Technical diagram with specifications',
              extractedText: 'Voltage: 220V, Current: 10A, Power: 2200W',
              confidence: 0.92
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await extractTextFromImage(mockFile);
      
      expect(result.extractedText).toBe('Voltage: 220V, Current: 10A, Power: 2200W');
      expect(result.confidence).toBe(0.92);
    });

    it('should handle images with no text', async () => {
      const mockFile = createMockImageFile('notext.jpg', 'image/jpeg', 1024 * 1024);
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Image with no readable text',
              extractedText: '',
              confidence: 0.8
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await extractTextFromImage(mockFile);
      
      expect(result.extractedText).toBe('');
    });
  });

  describe('analyzeImageBatch', () => {
    it('should analyze multiple images', async () => {
      const mockFiles = [
        createMockImageFile('img1.jpg', 'image/jpeg', 1024 * 1024),
        createMockImageFile('img2.jpg', 'image/jpeg', 1024 * 1024)
      ];
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Batch analysis result',
              confidence: 0.85
            })
          }
        }]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      const results = await analyzeImageBatch(mockFiles);
      
      expect(results).toHaveLength(2);
      expect(results[0].description).toBe('Batch analysis result');
      expect(results[1].description).toBe('Batch analysis result');
    });

    it('should handle batch processing with some failures', async () => {
      const mockFiles = [
        createMockImageFile('img1.jpg', 'image/jpeg', 1024 * 1024),
        createMockImageFile('img2.jpg', 'image/jpeg', 1024 * 1024)
      ];
      
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                description: 'Success',
                confidence: 0.9
              })
            }
          }]
        })
        .mockRejectedValueOnce(new Error('API Error'));
      
      const results = await analyzeImageBatch(mockFiles);
      
      expect(results).toHaveLength(2);
      expect(results[0].description).toBe('Success');
      expect(results[1].description).toBe('Failed to analyze image');
      expect(results[1].confidence).toBe(0);
    });
  });
});