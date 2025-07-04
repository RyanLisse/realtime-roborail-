import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateImage, validateImageContent, createMockImageFile } from '../../../lib/image/validation';
import { MAX_FILE_SIZE, MAX_IMAGE_DIMENSION, SUPPORTED_IMAGE_FORMATS } from '../../../lib/image/types';

describe('Image Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateImage', () => {
    it('should validate a valid JPEG image', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await validateImage(mockFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', async () => {
      const mockFile = createMockImageFile('large.jpg', 'image/jpeg', MAX_FILE_SIZE + 1);
      const result = await validateImage(mockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum allowed size');
    });

    it('should reject unsupported file formats', async () => {
      const mockFile = createMockImageFile('test.svg', 'image/svg+xml', 1024);
      const result = await validateImage(mockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported image format');
    });

    it('should validate all supported formats', async () => {
      for (const format of SUPPORTED_IMAGE_FORMATS) {
        const fileName = `test.${format.split('/')[1]}`;
        const mockFile = createMockImageFile(fileName, format, 1024 * 1024);
        const result = await validateImage(mockFile);
        
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject images with dimensions too large', async () => {
      const mockFile = createMockImageFile('huge.jpg', 'image/jpeg', 1024 * 1024);
      
      // Mock the Image constructor for this test only
      vi.mocked(global.Image).mockImplementationOnce(function() {
        const img = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          width: MAX_IMAGE_DIMENSION + 1,
          height: MAX_IMAGE_DIMENSION + 1,
          set src(value: string) {
            setTimeout(() => {
              this.onload?.();
            }, 0);
          }
        };
        return img as any;
      } as any);
      
      const result = await validateImage(mockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Image dimensions exceed maximum allowed size');
    });

    it('should provide warnings for large files', async () => {
      const mockFile = createMockImageFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6MB > 5MB threshold
      const result = await validateImage(mockFile);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large file size may affect performance');
    });
  });

  describe('validateImageContent', () => {
    it('should validate image content safety', async () => {
      const mockFile = createMockImageFile('test.jpg', 'image/jpeg', 1024 * 1024);
      const result = await validateImageContent(mockFile);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject corrupted images', async () => {
      const mockFile = createMockImageFile('corrupted.jpg', 'image/jpeg', 1024, new ArrayBuffer(0));
      const result = await validateImageContent(mockFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Image appears to be corrupted');
    });
  });
});