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
      className={`citation-card p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : 'article'}
      aria-label={`Citation ${citation.id}: ${formattedCitation.source}`}
    >
      <div className="citation-header flex items-center justify-between mb-2">
        <span className="citation-id font-semibold text-blue-600">
          {formattedCitation.display}
        </span>
        {citation.pageNumber && (
          <span className="citation-page text-sm text-gray-500">
            Page {citation.pageNumber}
          </span>
        )}
      </div>
      
      {showQuote && (
        <div className="citation-quote">
          <blockquote className="text-gray-700 text-sm italic border-l-4 border-blue-200 pl-3">
            "{citation.quote}"
          </blockquote>
        </div>
      )}
      
      <div className="citation-source mt-2 text-xs text-gray-500">
        Source: {formattedCitation.source}
      </div>
    </div>
  );
};

export default CitationCard;