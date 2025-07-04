export { ImageUpload } from './ImageUpload';
export { ImageViewer } from './ImageViewer';
export { ImagePreview } from './ImagePreview';

// Re-export types and utilities for convenience
export type {
  ImageFile,
  ProcessedImage,
  ImageValidationResult,
  ImageProcessingOptions,
  VisionAnalysisResult,
  ImageUploadState,
  ImageViewerState
} from '../../lib/image/types';

export {
  validateImage,
  validateImageContent,
  createMockImageFile
} from '../../lib/image/validation';

export {
  processImage,
  resizeImage,
  compressImage,
  convertImageFormat,
  createImageFromFile,
  cleanupImageUrl
} from '../../lib/image/processing';

export {
  analyzeImage,
  analyzeEquipmentImage,
  extractTextFromImage,
  analyzeImageBatch,
  formatAnalysisForChat
} from '../../lib/image/vision';

export { useImageUpload } from '../../hooks/useImageUpload';
export { useImageViewer } from '../../hooks/useImageViewer';