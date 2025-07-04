import { Citation, ParsedResponse, CitationError } from './types';

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

export interface FormattedCitation {
  id: number;
  display: string;
  quote: string;
  source: string;
}

export interface SourceInfo {
  filename?: string;
  pageNumber?: number;
}

export class CitationUtils {
  /**
   * Parses citations from text and annotations, replacing citation markers with numbered references
   */
  static parseCitations(text: string, annotations: Annotation[]): ParsedResponse {
    if (!text || annotations.length === 0) {
      return { text, citations: [] };
    }

    let processedText = text;
    const citations: Citation[] = [];
    
    // Filter and sort annotations by start_index in ascending order
    const validAnnotations = annotations
      .filter(annotation => annotation.type === 'file_citation')
      .sort((a, b) => a.start_index - b.start_index);

    // Create citations with sequential IDs
    validAnnotations.forEach((annotation, index) => {
      const citationId = index + 1;
      const sourceInfo = this.extractSourceInfo(annotation.file_citation.file_id);
      
      citations.push({
        id: citationId,
        fileId: annotation.file_citation.file_id,
        quote: annotation.file_citation.quote,
        originalText: annotation.text,
        filename: sourceInfo.filename,
        pageNumber: sourceInfo.pageNumber,
      });
    });

    // Process replacements from end to start to maintain correct indices
    const sortedForReplacement = [...validAnnotations].sort((a, b) => b.start_index - a.start_index);
    
    sortedForReplacement.forEach((annotation) => {
      // Find the citation ID for this annotation
      const citationIndex = validAnnotations.findIndex(a => a.start_index === annotation.start_index);
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

  /**
   * Formats a citation for display
   */
  static formatCitation(citation: Citation): FormattedCitation {
    let display = `[${citation.id}]`;
    let source = citation.filename || citation.fileId;

    if (citation.filename) {
      display += ` ${citation.filename}`;
      if (citation.pageNumber) {
        display += `, page ${citation.pageNumber}`;
      }
    } else {
      display += ` ${citation.fileId}`;
    }

    return {
      id: citation.id,
      display,
      quote: citation.quote,
      source,
    };
  }

  /**
   * Extracts source information from file ID
   */
  static extractSourceInfo(fileId: string): SourceInfo {
    // For standard file IDs like "file-12345", we don't extract meaningful filenames
    // This is because the actual filename info should come from the OpenAI API metadata
    // For now, return undefined to avoid confusion
    return { filename: undefined, pageNumber: undefined };
  }

  /**
   * Validates a citation object
   */
  static validateCitation(citation: Citation): void {
    if (!citation.id || citation.id <= 0) {
      throw new CitationError('Citation ID must be a positive number', citation.id);
    }

    if (!citation.fileId || citation.fileId.trim() === '') {
      throw new CitationError('Citation file ID is required', citation.id);
    }

    if (!citation.quote || citation.quote.trim() === '') {
      throw new CitationError('Citation quote is required', citation.id);
    }

    if (!citation.originalText || citation.originalText.trim() === '') {
      throw new CitationError('Citation original text is required', citation.id);
    }
  }

  /**
   * Deduplicates citations based on file ID and quote
   */
  static deduplicateCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    return citations.filter(citation => {
      const key = `${citation.fileId}-${citation.quote}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Sorts citations by their appearance in text (by ID)
   */
  static sortCitations(citations: Citation[]): Citation[] {
    return citations.sort((a, b) => a.id - b.id);
  }

  /**
   * Filters citations by file ID
   */
  static filterCitationsByFile(citations: Citation[], fileId: string): Citation[] {
    return citations.filter(citation => citation.fileId === fileId);
  }

  /**
   * Groups citations by their source file
   */
  static groupCitationsBySource(citations: Citation[]): Record<string, Citation[]> {
    return citations.reduce((groups, citation) => {
      const source = citation.filename || citation.fileId;
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(citation);
      return groups;
    }, {} as Record<string, Citation[]>);
  }
}