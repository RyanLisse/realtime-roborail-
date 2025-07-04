export interface ImageFile {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  size: number;
  type: string;
  lastModified: number;
}

export interface ProcessedImage {
  original: ImageFile;
  processed: {
    dataUrl: string;
    blob: Blob;
    width: number;
    height: number;
    size: number;
    compressionRatio: number;
  };
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

export interface VisionAnalysisResult {
  description: string;
  equipmentType?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  issues?: string[];
  recommendations?: string[];
  confidence: number;
  extractedText?: string;
}

export interface ImageUploadState {
  files: ImageFile[];
  isUploading: boolean;
  isProcessing: boolean;
  error: string | null;
  progress: number;
}

export interface ImageViewerState {
  scale: number;
  position: { x: number; y: number };
  isDragging: boolean;
  rotation: number;
}

export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif'
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_IMAGE_DIMENSION = 4096; // 4K resolution
export const DEFAULT_COMPRESSION_QUALITY = 0.8;
export const DEFAULT_MAX_WIDTH = 1920;
export const DEFAULT_MAX_HEIGHT = 1080;