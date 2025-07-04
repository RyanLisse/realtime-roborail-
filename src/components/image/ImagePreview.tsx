import React from 'react';
import { ImageFile, VisionAnalysisResult } from '../../lib/image/types';

interface ImagePreviewProps {
  image: ImageFile;
  analysis?: VisionAnalysisResult;
  onView?: (image: ImageFile) => void;
  onAnalyze?: (image: ImageFile) => void;
  onRemove?: (image: ImageFile) => void;
  size?: 'small' | 'medium' | 'large';
  showAnalysis?: boolean;
  className?: string;
}

export function ImagePreview({
  image,
  analysis,
  onView,
  onAnalyze,
  onRemove,
  size = 'medium',
  showAnalysis = true,
  className = ''
}: ImagePreviewProps) {
  const sizeMap = {
    small: { width: 80, height: 80 },
    medium: { width: 120, height: 120 },
    large: { width: 200, height: 200 }
  };

  const { width, height } = sizeMap[size];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConditionColor = (condition?: string): string => {
    switch (condition) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getConditionIcon = (condition?: string): string => {
    switch (condition) {
      case 'excellent': return '✅';
      case 'good': return '✓';
      case 'fair': return '⚠️';
      case 'poor': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className={`image-preview ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease'
    }}>
      {/* Image Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        backgroundColor: '#f9fafb'
      }}>
        <img
          src={image.url}
          alt={image.file.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: onView ? 'pointer' : 'default'
          }}
          onClick={() => onView?.(image)}
        />
        
        {/* Action Buttons Overlay */}
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          display: 'flex',
          gap: '0.25rem'
        }}>
          {onAnalyze && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze(image);
              }}
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px'
              }}
              title="Analyze with AI"
            >
              🔍
            </button>
          )}
          
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(image);
              }}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px'
              }}
              title="Remove image"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Analysis Status Badge */}
        {analysis && (
          <div style={{
            position: 'absolute',
            bottom: '0.5rem',
            left: '0.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '0.25rem 0.5rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span>{getConditionIcon(analysis.condition)}</span>
            <span style={{ color: getConditionColor(analysis.condition) }}>
              {analysis.condition || 'analyzed'}
            </span>
          </div>
        )}
      </div>

      {/* Image Info */}
      <div style={{
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div>
          <h4 style={{
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#374151',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {image.file.name}
          </h4>
          <p style={{
            margin: 0,
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            {image.width}×{image.height} • {formatFileSize(image.size)}
          </p>
        </div>

        {/* Analysis Results */}
        {showAnalysis && analysis && (
          <div style={{
            borderTop: '1px solid #f3f4f6',
            paddingTop: '0.5rem'
          }}>
            {analysis.equipmentType && (
              <p style={{
                margin: 0,
                fontSize: '0.75rem',
                color: '#374151',
                fontWeight: '500'
              }}>
                {analysis.equipmentType}
              </p>
            )}
            
            {analysis.description && (
              <p style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.75rem',
                color: '#6b7280',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {analysis.description}
              </p>
            )}
            
            {analysis.issues && analysis.issues.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  fontWeight: '500'
                }}>
                  Issues: {analysis.issues.length}
                </p>
              </div>
            )}
            
            <div style={{
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: '#6b7280'
              }}>
                Confidence: {Math.round(analysis.confidence * 100)}%
              </span>
              
              {analysis.condition && (
                <span style={{
                  fontSize: '0.75rem',
                  color: getConditionColor(analysis.condition),
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  {analysis.condition}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '0.5rem'
        }}>
          {onView && (
            <button
              onClick={() => onView(image)}
              style={{
                flex: 1,
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              View
            </button>
          )}
          
          {onAnalyze && !analysis && (
            <button
              onClick={() => onAnalyze(image)}
              style={{
                flex: 1,
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Analyze
            </button>
          )}
        </div>
      </div>
    </div>
  );
}