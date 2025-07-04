import { useState, useCallback, useRef, useEffect } from 'react';
import { ImageViewerState } from '../lib/image/types';

export function useImageViewer() {
  const [state, setState] = useState<ImageViewerState>({
    scale: 1,
    position: { x: 0, y: 0 },
    isDragging: false,
    rotation: 0
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const resetView = useCallback(() => {
    setState({
      scale: 1,
      position: { x: 0, y: 0 },
      isDragging: false,
      rotation: 0
    });
  }, []);

  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 5)
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.1)
    }));
  }, []);

  const fitToContainer = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current;
    const image = imageRef.current;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    setState(prev => ({
      ...prev,
      scale,
      position: { x: 0, y: 0 }
    }));
  }, []);

  const rotate = useCallback((degrees: number) => {
    setState(prev => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360
    }));
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only left click
    
    event.preventDefault();
    dragStart.current = { x: event.clientX, y: event.clientY };
    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!state.isDragging || !dragStart.current) return;

    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;
    
    setState(prev => ({
      ...prev,
      position: {
        x: prev.position.x + deltaX,
        y: prev.position.y + deltaY
      }
    }));
    
    dragStart.current = { x: event.clientX, y: event.clientY };
  }, [state.isDragging]);

  const handleMouseUp = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: false }));
    dragStart.current = null;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY;
    const scaleFactor = delta > 0 ? 0.9 : 1.1;
    
    setState(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale * scaleFactor))
    }));
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        zoomIn();
        break;
      case '-':
        event.preventDefault();
        zoomOut();
        break;
      case '0':
        event.preventDefault();
        resetView();
        break;
      case 'f':
        event.preventDefault();
        fitToContainer();
        break;
      case 'r':
        event.preventDefault();
        rotate(90);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          position: { x: prev.position.x - 10, y: prev.position.y }
        }));
        break;
      case 'ArrowRight':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          position: { x: prev.position.x + 10, y: prev.position.y }
        }));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          position: { x: prev.position.x, y: prev.position.y - 10 }
        }));
        break;
      case 'ArrowDown':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          position: { x: prev.position.x, y: prev.position.y + 10 }
        }));
        break;
    }
  }, [zoomIn, zoomOut, resetView, fitToContainer, rotate]);

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Clean up dragging state on unmount
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setState(prev => ({ ...prev, isDragging: false }));
      dragStart.current = null;
    };

    if (state.isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [state.isDragging]);

  return {
    ...state,
    containerRef,
    imageRef,
    resetView,
    zoomIn,
    zoomOut,
    fitToContainer,
    rotate,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel
  };
}