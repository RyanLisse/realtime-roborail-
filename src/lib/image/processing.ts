import { 
  ImageFile, 
  ProcessedImage, 
  ImageProcessingOptions,
  DEFAULT_COMPRESSION_QUALITY,
  DEFAULT_MAX_WIDTH,
  DEFAULT_MAX_HEIGHT
} from './types';

export async function processImage(
  file: File, 
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const imageFile = await createImageFromFile(file);
  
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_COMPRESSION_QUALITY,
    format = 'jpeg',
    maintainAspectRatio = true
  } = options;

  // Resize image if needed
  const resizeResult = await resizeImage(file, maxWidth, maxHeight, maintainAspectRatio);
  
  // Compress the resized image
  const compressResult = await compressImage(file, quality, format);
  
  return {
    original: imageFile,
    processed: {
      dataUrl: compressResult.dataUrl,
      blob: compressResult.blob,
      width: resizeResult.width,
      height: resizeResult.height,
      size: compressResult.blob.size,
      compressionRatio: compressResult.compressionRatio
    }
  };
}

export async function resizeImage(
  file: File, 
  maxWidth: number, 
  maxHeight: number, 
  maintainAspectRatio: boolean = true
): Promise<{ width: number; height: number; canvas: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      let { width, height } = img;
      
      if (maintainAspectRatio) {
        const aspectRatio = width / height;
        
        if (width > height) {
          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
        } else {
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
      } else {
        width = Math.min(width, maxWidth);
        height = Math.min(height, maxHeight);
      }

      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve({ width, height, canvas });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(
  file: File, 
  quality: number = DEFAULT_COMPRESSION_QUALITY,
  format: 'jpeg' | 'png' | 'webp' = 'jpeg'
): Promise<{ blob: Blob; dataUrl: string; compressionRatio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      const mimeType = `image/${format}`;
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const compressionRatio = blob.size / file.size;
        
        resolve({ blob, dataUrl, compressionRatio });
      }, mimeType, quality);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

export async function convertImageFormat(
  file: File, 
  targetFormat: 'jpeg' | 'png' | 'webp'
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      // For JPEG conversion, fill background with white
      if (targetFormat === 'jpeg') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(img, 0, 0);
      
      const mimeType = `image/${targetFormat}`;
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        
        const dataUrl = canvas.toDataURL(mimeType);
        resolve({ blob, dataUrl });
      }, mimeType);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

export async function createImageFromFile(file: File): Promise<ImageFile> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const imageFile: ImageFile = {
        id: generateImageId(),
        file,
        url: URL.createObjectURL(file),
        width: img.width,
        height: img.height,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      
      resolve(imageFile);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function cleanupImageUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}