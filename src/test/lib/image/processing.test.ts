import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  processImage, 
  resizeImage, 
  compressImage, 
  convertImageFormat,
  createImageFromFile 
} from '../../../lib/image/processing';
import { createMockImageFile } from '../../../lib/image/validation';
import { ImageProcessingOptions } from '../../../lib/image/types';

describe('Image Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processImage', () => {
    it('should process image with default options', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await processImage(mockFile);
      
      expect(result.original.file).toBe(mockFile);
      expect(result.processed.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.processed.blob).toBeInstanceOf(Blob);
      expect(result.processed.compressionRatio).toBeGreaterThan(0);
    });

    it('should process image with custom options', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const options: ImageProcessingOptions = {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.7,
        format: 'jpeg'
      };
      
      const result = await processImage(mockFile, options);
      
      expect(result.processed.width).toBeLessThanOrEqual(800);
      expect(result.processed.height).toBeLessThanOrEqual(600);
    });

    it('should maintain aspect ratio when resizing', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const options: ImageProcessingOptions = {
        maxWidth: 800,
        maxHeight: 600,
        maintainAspectRatio: true
      };
      
      const result = await processImage(mockFile, options);
      
      expect(result.processed.width).toBeLessThanOrEqual(800);
      expect(result.processed.height).toBeLessThanOrEqual(600);
    });
  });

  describe('resizeImage', () => {
    it('should resize image to specified dimensions', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await resizeImage(mockFile, 800, 600, false); // Disable aspect ratio maintenance
      
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should maintain aspect ratio when specified', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await resizeImage(mockFile, 800, 600, true);
      
      expect(result.width).toBeLessThanOrEqual(800);
      expect(result.height).toBeLessThanOrEqual(600);
    });
  });

  describe('compressImage', () => {
    it('should compress image with specified quality', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await compressImage(mockFile, 0.5);
      
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should use default quality when not specified', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await compressImage(mockFile);
      
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('convertImageFormat', () => {
    it('should convert image to specified format', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await convertImageFormat(mockFile, 'png');
      
      expect(result.blob.type).toBe('image/png');
      expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should convert HEIC to JPEG', async () => {
      const mockFile = createMockImageFile('test.heic', 'image/heic', 1024 * 1024);
      const result = await convertImageFormat(mockFile, 'jpeg');
      
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('createImageFromFile', () => {
    it('should create ImageFile from File object', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await createImageFromFile(mockFile);
      
      expect(result.id).toBeDefined();
      expect(result.file).toBe(mockFile);
      expect(result.url).toMatch(/^blob:/);
      expect(result.size).toBe(1024 * 1024);
      expect(result.type).toBe('image/jpeg');
    });

    it('should generate unique IDs for different files', async () => {
      const mockFile1 = createMockImageFile('test1.jpg', 'image/jpeg', 1024 * 1024);
      const mockFile2 = createMockImageFile('test2.jpg', 'image/jpeg', 1024 * 1024);
      
      const result1 = await createImageFromFile(mockFile1);
      const result2 = await createImageFromFile(mockFile2);
      
      expect(result1.id).not.toBe(result2.id);
    });
  });
});