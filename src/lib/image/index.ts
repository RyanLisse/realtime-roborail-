// Main exports for the image processing library
export * from './types';
export * from './validation';
export * from './processing';
export * from './vision';

// Default configuration
export const IMAGE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxDimension: 4096,
  defaultQuality: 0.8,
  defaultMaxWidth: 1920,
  defaultMaxHeight: 1080,
  supportedFormats: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/heic',
    'image/heif'
  ]
} as const;

// Utility functions
export function isImageFile(file: File): boolean {
  return IMAGE_CONFIG.supportedFormats.includes(file.type as any);
}

export function getImageFormatFromMimeType(mimeType: string): string {
  return mimeType.split('/')[1];
}

export function createImageFileId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}