import { useState, useCallback, useRef } from 'react';
import { ImageFile, ImageUploadState, ProcessedImage } from '../lib/image/types';
import { validateImage } from '../lib/image/validation';
import { processImage, createImageFromFile, cleanupImageUrl } from '../lib/image/processing';

export function useImageUpload() {
  const [state, setState] = useState<ImageUploadState>({
    files: [],
    isUploading: false,
    isProcessing: false,
    error: null,
    progress: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: File[]) => {
    setState(prev => ({ ...prev, isUploading: true, error: null, progress: 0 }));

    try {
      const validFiles: File[] = [];
      const errors: string[] = [];

      // Validate all files first
      for (const file of files) {
        const validation = await validateImage(file);
        if (validation.isValid) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${validation.errors.join(', ')}`);
        }
      }

      if (errors.length > 0) {
        setState(prev => ({ 
          ...prev, 
          isUploading: false, 
          error: `Some files were rejected: ${errors.join('; ')}` 
        }));
        return;
      }

      // Process valid files
      const imageFiles: ImageFile[] = [];
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const imageFile = await createImageFromFile(file);
        imageFiles.push(imageFile);
        
        setState(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / validFiles.length) * 100)
        }));
      }

      setState(prev => ({
        ...prev,
        files: [...prev.files, ...imageFiles],
        isUploading: false,
        progress: 100
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : 'Failed to upload files'
      }));
    }
  }, []);

  const processFiles = useCallback(async (files: ImageFile[]) => {
    setState(prev => ({ ...prev, isProcessing: true, error: null, progress: 0 }));

    try {
      const processedImages: ProcessedImage[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const processed = await processImage(file.file);
        processedImages.push(processed);
        
        setState(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / files.length) * 100)
        }));
      }

      setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
      return processedImages;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process files'
      }));
      return [];
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setState(prev => {
      const file = prev.files.find(f => f.id === id);
      if (file) {
        cleanupImageUrl(file.url);
      }
      return {
        ...prev,
        files: prev.files.filter(f => f.id !== id)
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    // Cleanup all URLs
    state.files.forEach(file => cleanupImageUrl(file.url));
    
    setState({
      files: [],
      isUploading: false,
      isProcessing: false,
      error: null,
      progress: 0
    });
  }, [state.files]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fileInputRef,
    addFiles,
    processFiles,
    removeFile,
    clearAll,
    openFileDialog,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    clearError
  };
}