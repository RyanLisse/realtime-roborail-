import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Citation } from '@/lib/openai/types';
import { SourceContent, GetSourceResponse } from '@/app/api/getSource/route';

export interface CitationSourceModalProps {
  citation: Citation | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for displaying detailed source content for citations
 */
export function CitationSourceModal({ citation, isOpen, onClose }: CitationSourceModalProps) {
  const [sourceContent, setSourceContent] = useState<SourceContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch source content when modal opens and citation changes
  useEffect(() => {
    if (!isOpen || !citation?.fileId) {
      setSourceContent(null);
      setError(null);
      return;
    }

    fetchSourceContent();
  }, [isOpen, citation]);

  const fetchSourceContent = async () => {
    if (!citation?.fileId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fileId: citation.fileId,
        ...(citation.pageNumber && { pageNumber: citation.pageNumber.toString() }),
        contextLines: '5', // Show more context for better understanding
      });

      const response = await fetch(`/api/getSource?${params}`, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'user-session-key'}`,
        },
      });

      const result: GetSourceResponse = await response.json();

      if (result.success && result.data) {
        setSourceContent(result.data);
      } else {
        setError(result.error?.message || 'Failed to load source content');
      }
    } catch (err) {
      console.error('Error fetching source content:', err);
      setError('Failed to load source content');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!sourceContent) return;

    // Create a downloadable file from the content
    const blob = new Blob([sourceContent.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sourceContent.filename || 'source-content.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Source Content"
      size="xl"
      className="citation-source-modal"
    >
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading source content...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                Error loading source
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={fetchSourceContent}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {sourceContent && (
        <div className="space-y-6">
          {/* Citation Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Citation Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Quote:</span>
                <p className="text-gray-900 dark:text-white font-medium mt-1 italic">
                  "{citation?.quote || citation?.originalText}"
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Page:</span>
                <p className="text-gray-900 dark:text-white">
                  {citation?.pageNumber || sourceContent.metadata.pageNumber || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Source Metadata */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Source File
              </h3>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-blue-600 dark:text-blue-300">Filename:</span>
                <p className="text-blue-900 dark:text-blue-100 font-medium truncate" title={sourceContent.filename}>
                  {sourceContent.filename}
                </p>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-300">Size:</span>
                <p className="text-blue-900 dark:text-blue-100">
                  {formatFileSize(sourceContent.metadata.size)}
                </p>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-300">Created:</span>
                <p className="text-blue-900 dark:text-blue-100">
                  {sourceContent.metadata.createdAt ? 
                    new Date(sourceContent.metadata.createdAt).toLocaleDateString() : 
                    'Unknown'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Context Before (if available) */}
          {sourceContent.context?.before && (
            <div className="border-l-4 border-gray-300 pl-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Context Before
              </h4>
              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                {sourceContent.context.before}
              </pre>
            </div>
          )}

          {/* Main Content */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
              Source Content
            </h4>
            <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 shadow-sm">
              <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                {sourceContent.content}
              </pre>
            </div>
          </div>

          {/* Context After (if available) */}
          {sourceContent.context?.after && (
            <div className="border-l-4 border-gray-300 pl-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Context After
              </h4>
              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                {sourceContent.context.after}
              </pre>
            </div>
          )}

          {/* Line numbers info (if available) */}
          {sourceContent.context?.startLine && sourceContent.context?.endLine && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Lines {sourceContent.context.startLine} - {sourceContent.context.endLine}
              {sourceContent.metadata.totalPages && (
                <span> • Page {sourceContent.metadata.pageNumber} of {sourceContent.metadata.totalPages}</span>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && !sourceContent && citation && (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No source content available</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Unable to retrieve source content for this citation.
          </p>
        </div>
      )}
    </Modal>
  );
}