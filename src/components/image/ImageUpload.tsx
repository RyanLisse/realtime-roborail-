import React from 'react';
import { useImageUpload } from '../../hooks/useImageUpload';
import { SUPPORTED_IMAGE_FORMATS, MAX_FILE_SIZE } from '../../lib/image/types';

interface ImageUploadProps {
  onFilesAdded?: (files: File[]) => void;
  onError?: (error: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  accept?: string;
}

export function ImageUpload({
  onFilesAdded,
  onError,
  multiple = true,
  disabled = false,
  className = '',
  accept = SUPPORTED_IMAGE_FORMATS.join(',')
}: ImageUploadProps) {
  const {
    files,
    isUploading,
    error,
    progress,
    fileInputRef,
    addFiles,
    removeFile,
    clearAll,
    openFileDialog,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    clearError
  } = useImageUpload();

  const handleFiles = React.useCallback(async (selectedFiles: File[]) => {
    await addFiles(selectedFiles);
    onFilesAdded?.(selectedFiles);
  }, [addFiles, onFilesAdded]);

  const handleAddFiles = React.useCallback(async (selectedFiles: File[]) => {
    await handleFiles(selectedFiles);
  }, [handleFiles]);

  React.useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const supportedFormats = SUPPORTED_IMAGE_FORMATS.map(format => 
    format.split('/')[1].toUpperCase()
  ).join(', ');

  return (
    <div className={`image-upload ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      <div
        className={`drop-zone ${isUploading ? 'uploading' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={disabled ? undefined : openFileDialog}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: disabled ? '#f9fafb' : '#fafafa',
          transition: 'all 0.2s ease'
        }}
      >
        {isUploading ? (
          <div className="upload-progress">
            <div className="upload-spinner" style={{ 
              width: '24px', 
              height: '24px', 
              border: '2px solid #f3f4f6',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <p>Uploading... {progress}%</p>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '0.5rem'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.2s ease'
              }} />
            </div>
          </div>
        ) : (
          <>
            <svg
              className="upload-icon"
              style={{ width: '48px', height: '48px', margin: '0 auto 1rem', color: '#6b7280' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
              {disabled ? 'Upload disabled' : 'Drop images here or click to select'}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Supported formats: {supportedFormats}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </>
        )}
      </div>

      {error && (
        <div 
          className="error-message"
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1.25rem'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="uploaded-files" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', color: '#374151' }}>
              Uploaded Files ({files.length})
            </h3>
            <button
              onClick={clearAll}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {files.map((file) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img
                    src={file.url}
                    alt={file.file.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginRight: '0.75rem'
                    }}
                  />
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', margin: 0 }}>
                      {file.file.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                      {formatFileSize(file.size)} • {file.width}×{file.height}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '1.25rem'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .drop-zone:hover:not(.disabled) {
          border-color: #3b82f6;
          background-color: #f0f9ff;
        }
        
        .drop-zone.uploading {
          border-color: #3b82f6;
          background-color: #f0f9ff;
        }
      `}</style>
    </div>
  );
}