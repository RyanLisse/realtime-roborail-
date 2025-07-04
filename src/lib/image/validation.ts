import { 
  ImageValidationResult, 
  MAX_FILE_SIZE, 
  MAX_IMAGE_DIMENSION, 
  SUPPORTED_IMAGE_FORMATS 
} from './types';

export async function validateImage(file: File): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push('File size exceeds maximum allowed size');
  } else if (file.size > 5 * 1024 * 1024) { // 5MB
    warnings.push('Large file size may affect performance');
  }

  // Check file format
  if (!SUPPORTED_IMAGE_FORMATS.includes(file.type as any)) {
    errors.push('Unsupported image format');
  }

  // Check image dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
      errors.push('Image dimensions exceed maximum allowed size');
    }
  } catch (error) {
    errors.push('Failed to read image dimensions');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export async function validateImageContent(file: File): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if file is actually an image by trying to read it
    const arrayBuffer = await file.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
      errors.push('Image appears to be corrupted');
      return { isValid: false, errors, warnings };
    }

    // Basic image header validation
    const uint8Array = new Uint8Array(arrayBuffer);
    const isValidImage = validateImageHeader(uint8Array, file.type);
    
    if (!isValidImage) {
      errors.push('Image appears to be corrupted');
    }

  } catch (error) {
    errors.push('Failed to validate image content');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

function validateImageHeader(data: Uint8Array, mimeType: string): boolean {
  // Basic header validation for common formats
  const signatures: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'image/bmp': [0x42, 0x4D],
    'image/webp': [0x52, 0x49, 0x46, 0x46]
  };

  const signature = signatures[mimeType];
  if (!signature) {
    return true; // Skip validation for unsupported formats
  }

  if (data.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => data[index] === byte);
}

// Test utility function
export function createMockImageFile(
  name: string, 
  type: string, 
  size: number, 
  content?: ArrayBuffer
): File {
  // Create a proper buffer with some mock data
  let buffer: ArrayBuffer;
  if (content) {
    buffer = content;
  } else {
    buffer = new ArrayBuffer(size);
    const uint8Array = new Uint8Array(buffer);
    
    // Add proper image headers based on type
    if (type === 'image/jpeg') {
      uint8Array[0] = 0xFF;
      uint8Array[1] = 0xD8;
      uint8Array[2] = 0xFF;
    } else if (type === 'image/png') {
      uint8Array[0] = 0x89;
      uint8Array[1] = 0x50;
      uint8Array[2] = 0x4E;
      uint8Array[3] = 0x47;
      uint8Array[4] = 0x0D;
      uint8Array[5] = 0x0A;
      uint8Array[6] = 0x1A;
      uint8Array[7] = 0x0A;
    } else if (type === 'image/gif') {
      uint8Array[0] = 0x47;
      uint8Array[1] = 0x49;
      uint8Array[2] = 0x46;
      uint8Array[3] = 0x38;
    }
    
    // Fill the rest with some data
    for (let i = 10; i < Math.min(100, size); i++) {
      uint8Array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  
  // Override arrayBuffer method to return our specific buffer
  file.arrayBuffer = () => Promise.resolve(buffer);
  
  return file;
}