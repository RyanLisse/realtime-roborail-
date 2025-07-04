import React from 'react';
import { useImageViewer } from '../../hooks/useImageViewer';
import { ImageFile } from '../../lib/image/types';

interface ImageViewerProps {
  image: ImageFile;
  onClose?: () => void;
  onAnalyze?: (image: ImageFile) => void;
  className?: string;
}

export function ImageViewer({ image, onClose, onAnalyze, className = '' }: ImageViewerProps) {
  const {
    scale,
    position,
    rotation,
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
  } = useImageViewer();

  const imageStyle = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: 'center',
    transition: 'transform 0.1s ease-out',
    cursor: 'grab',
    maxWidth: 'none',
    maxHeight: 'none'
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`image-viewer ${className}`} style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        backdropFilter: 'blur(8px)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
            {image.file.name}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#d1d5db' }}>
            {image.width}×{image.height} • {formatFileSize(image.size)}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onAnalyze && (
            <button
              onClick={() => onAnalyze(image)}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Analyze with AI
            </button>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                color: 'white',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '1.25rem',
                cursor: 'pointer',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        gap: '0.5rem'
      }}>
        <button
          onClick={zoomOut}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
          title="Zoom Out (-)"
        >
          🔍−
        </button>
        
        <span style={{ 
          fontSize: '0.875rem', 
          minWidth: '60px',
          textAlign: 'center'
        }}>
          {Math.round(scale * 100)}%
        </span>
        
        <button
          onClick={zoomIn}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
          title="Zoom In (+)"
        >
          🔍+
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: '#4b5563', margin: '0 0.5rem' }} />
        
        <button
          onClick={fitToContainer}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
          title="Fit to Screen (F)"
        >
          Fit
        </button>
        
        <button
          onClick={resetView}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
          title="Reset View (0)"
        >
          Reset
        </button>
        
        <button
          onClick={() => rotate(90)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
          title="Rotate (R)"
        >
          ↻
        </button>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={image.url}
          alt={image.file.name}
          style={imageStyle}
          draggable={false}
          onLoad={fitToContainer}
        />
      </div>

      {/* Instructions */}
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#d1d5db',
        fontSize: '0.75rem',
        textAlign: 'center',
        borderTop: '1px solid #374151'
      }}>
        Use mouse wheel or +/- to zoom • Drag to pan • Arrow keys to move • F to fit • R to rotate • 0 to reset
      </div>
    </div>
  );
}