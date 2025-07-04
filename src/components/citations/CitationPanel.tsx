import React, { useState, useEffect } from 'react';
import { Citation } from '../../lib/openai/types';
import { CitationUtils } from '../../lib/openai/citations';
import CitationCard from './CitationCard';

export interface CitationPanelProps {
  citations: Citation[];
  title?: string;
  className?: string;
  onCitationClick?: (citation: Citation) => void;
  groupBySource?: boolean;
  showSearch?: boolean;
  maxHeight?: string;
}

export const CitationPanel: React.FC<CitationPanelProps> = ({
  citations,
  title = 'Sources',
  className = '',
  onCitationClick,
  groupBySource = false,
  showSearch = false,
  maxHeight = '400px',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCitations, setFilteredCitations] = useState(citations);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredCitations(citations);
      return;
    }

    const filtered = citations.filter(citation =>
      citation.quote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (citation.filename && citation.filename.toLowerCase().includes(searchTerm.toLowerCase())) ||
      citation.fileId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredCitations(filtered);
  }, [searchTerm, citations]);

  const handleCitationClick = (citation: Citation) => {
    if (onCitationClick) {
      onCitationClick(citation);
    }
  };

  const renderCitationGroups = () => {
    if (!groupBySource) {
      return (
        <div className="citations-list space-y-3">
          {filteredCitations.map(citation => (
            <CitationCard
              key={`${citation.id}-${citation.fileId}`}
              citation={citation}
              onClick={onCitationClick}
              className="w-full"
            />
          ))}
        </div>
      );
    }

    const groups = CitationUtils.groupCitationsBySource(filteredCitations);

    return (
      <div className="citations-groups space-y-4">
        {Object.entries(groups).map(([source, sourceCitations]) => (
          <div key={source} className="citation-group">
            <h4 className="font-semibold text-gray-800 mb-2 text-sm">
              {source}
            </h4>
            <div className="citations-list space-y-2 ml-4">
              {sourceCitations.map(citation => (
                <CitationCard
                  key={`${citation.id}-${citation.fileId}`}
                  citation={citation}
                  onClick={onCitationClick}
                  className="w-full"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (citations.length === 0) {
    return (
      <div className={`citation-panel ${className}`}>
        <div className="text-center text-gray-500 py-8">
          <p>No sources available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`citation-panel ${className}`}>
      <div className="citation-panel-header mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {title}
        </h3>
        <div className="text-sm text-gray-600 mb-3">
          {citations.length} source{citations.length !== 1 ? 's' : ''}
        </div>
        
        {showSearch && (
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search citations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        )}
      </div>
      
      <div 
        className="citation-panel-content overflow-y-auto"
        style={{ maxHeight }}
      >
        {renderCitationGroups()}
      </div>
      
      {filteredCitations.length === 0 && searchTerm && (
        <div className="text-center text-gray-500 py-4">
          <p>No sources match your search</p>
        </div>
      )}
    </div>
  );
};

export default CitationPanel;