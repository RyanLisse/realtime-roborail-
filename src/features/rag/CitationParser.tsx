import React from 'react';

export interface Citation {
  id: number;
  fileId: string;
  quote: string;
  originalText: string;
}

export interface ParsedResponse {
  text: string;
  citations: Citation[];
}

export interface Annotation {
  type: 'file_citation';
  text: string;
  start_index: number;
  end_index: number;
  file_citation: {
    file_id: string;
    quote: string;
  };
}

export interface CitationParserProps {
  parsedResponse: ParsedResponse;
}

export class CitationUtils {
  static parseCitations(text: string, annotations: Annotation[]): ParsedResponse {
    if (!text || annotations.length === 0) {
      return { text, citations: [] };
    }

    let processedText = text;
    const citations: Citation[] = [];
    
    // Sort annotations by start_index in ascending order to assign citation IDs consistently
    const sortedAnnotations = [...annotations]
      .filter(annotation => annotation.type === 'file_citation')
      .sort((a, b) => a.start_index - b.start_index);

    // Create citations with sequential IDs
    sortedAnnotations.forEach((annotation, index) => {
      const citationId = index + 1;
      
      citations.push({
        id: citationId,
        fileId: annotation.file_citation.file_id,
        quote: annotation.file_citation.quote,
        originalText: annotation.text,
      });
    });

    // Process replacements from end to start to maintain correct indices
    const sortedForReplacement = [...sortedAnnotations].sort((a, b) => b.start_index - a.start_index);
    
    sortedForReplacement.forEach((annotation) => {
      // Find the citation ID for this annotation
      const citationIndex = sortedAnnotations.findIndex(a => a.start_index === annotation.start_index);
      const citationId = citationIndex + 1;
      
      // Replace the citation marker with numbered reference
      processedText = 
        processedText.slice(0, annotation.start_index) +
        `[${citationId}]` +
        processedText.slice(annotation.end_index);
    });

    return {
      text: processedText,
      citations,
    };
  }
}

export const CitationParser: React.FC<CitationParserProps> = ({ parsedResponse }) => {
  const renderTextWithCitations = (text: string, citations: Citation[]) => {
    if (citations.length === 0) {
      return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    citations.forEach((citation) => {
      const citationPattern = `[${citation.id}]`;
      const citationIndex = text.indexOf(citationPattern, currentIndex);
      
      if (citationIndex !== -1) {
        // Add text before citation
        if (citationIndex > currentIndex) {
          parts.push(text.slice(currentIndex, citationIndex));
        }
        
        // Add citation link
        parts.push(
          <span
            key={`citation-${citation.id}`}
            className="citation-link text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
            onClick={() => {
              const element = document.getElementById(`citation-${citation.id}`);
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {citationPattern}
          </span>
        );
        
        currentIndex = citationIndex + citationPattern.length;
      }
    });

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }

    return <>{parts}</>;
  };

  return (
    <div className="citation-parser">
      <div className="response-text mb-4">
        {renderTextWithCitations(parsedResponse.text, parsedResponse.citations)}
      </div>
      
      {parsedResponse.citations.length > 0 && (
        <div className="citations-section">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources:</h4>
          <div className="citations-list space-y-2">
            {parsedResponse.citations.map((citation) => (
              <div
                key={citation.id}
                id={`citation-${citation.id}`}
                className="citation-item p-2 bg-gray-50 rounded border-l-4 border-blue-500"
              >
                <span className="citation-number font-medium text-blue-600">
                  [{citation.id}]
                </span>
                <span className="citation-quote text-gray-700 ml-2">
                  {citation.quote}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};