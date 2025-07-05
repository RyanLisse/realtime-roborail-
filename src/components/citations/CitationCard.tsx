import React from 'react';
import { Citation } from '../../lib/openai/types';
import { CitationUtils } from '../../lib/openai/citations';

export interface CitationCardProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
  showQuote?: boolean;
  className?: string;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  citation,
  onClick,
  showQuote = true,
  className = '',
}) => {
  const formattedCitation = CitationUtils.formatCitation(citation);

  const handleClick = () => {
    if (onClick) {
      onClick(citation);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`citation-card p-3 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600' : ''
      } ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : 'article'}
      aria-label={`Citation ${citation.id}: ${formattedCitation.source}${onClick ? '. Click to view source' : ''}`}
    >
      <div className="citation-header flex items-center justify-between mb-2">
        <span className="citation-id font-semibold text-blue-600 dark:text-blue-400">
          {formattedCitation.display}
        </span>
        <div className="flex items-center gap-2">
          {citation.pageNumber && (
            <span className="citation-page text-sm text-gray-500 dark:text-gray-400">
              Page {citation.pageNumber}
            </span>
          )}
          {onClick && (
            <svg 
              className="w-4 h-4 text-gray-400 dark:text-gray-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
              />
            </svg>
          )}
        </div>
      </div>
      
      {showQuote && (
        <div className="citation-quote">
          <blockquote className="text-gray-700 dark:text-gray-300 text-sm italic border-l-4 border-blue-200 dark:border-blue-600 pl-3">
            "{citation.quote}"
          </blockquote>
        </div>
      )}
      
      <div className="citation-source mt-2 text-xs text-gray-500 dark:text-gray-400">
        Source: {formattedCitation.source}
      </div>
    </div>
  );
};

export default CitationCard;