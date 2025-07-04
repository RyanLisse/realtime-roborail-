import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CitationParser, CitationUtils } from './CitationParser';

describe('CitationParser', () => {
  describe('parseCitations', () => {
    it('should parse text with citations and return structured data', () => {
      const text = 'This is a response with citation 【source:test.pdf】 and another 【source:guide.pdf】.';
      const annotations = [
        {
          type: 'file_citation' as const,
          text: '【source:test.pdf】',
          start_index: 33,
          end_index: 50,
          file_citation: {
            file_id: 'file-1',
            quote: 'Test quote from document',
          },
        },
        {
          type: 'file_citation' as const,
          text: '【source:guide.pdf】',
          start_index: 63,
          end_index: 81,
          file_citation: {
            file_id: 'file-2',
            quote: 'Guide quote from document',
          },
        },
      ];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result.text).toBe('This is a response with citation [1] and another [2].');
      expect(result.citations).toHaveLength(2);
      expect(result.citations[0]).toEqual({
        id: 1,
        fileId: 'file-1',
        quote: 'Test quote from document',
        originalText: '【source:test.pdf】',
      });
      expect(result.citations[1]).toEqual({
        id: 2,
        fileId: 'file-2',
        quote: 'Guide quote from document',
        originalText: '【source:guide.pdf】',
      });
    });

    it('should handle text without citations', () => {
      const text = 'This is a response without citations.';
      const annotations: any[] = [];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result.text).toBe('This is a response without citations.');
      expect(result.citations).toHaveLength(0);
    });

    it('should handle empty text', () => {
      const text = '';
      const annotations: any[] = [];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result.text).toBe('');
      expect(result.citations).toHaveLength(0);
    });
  });

  describe('CitationParser component', () => {
    it('should render text with citation links', () => {
      const parsedResponse = {
        text: 'This is a response with citation [1] and another [2].',
        citations: [
          {
            id: 1,
            fileId: 'file-1',
            quote: 'Test quote from document',
            originalText: '【source:test.pdf】',
          },
          {
            id: 2,
            fileId: 'file-2',
            quote: 'Guide quote from document',
            originalText: '【source:guide.pdf】',
          },
        ],
      };

      render(<CitationParser parsedResponse={parsedResponse} />);

      expect(screen.getByText(/This is a response with citation/)).toBeInTheDocument();
      expect(screen.getAllByText('[1]')).toHaveLength(2); // One in text, one in citation list
      expect(screen.getByText(/and another/)).toBeInTheDocument();
      expect(screen.getAllByText('[2]')).toHaveLength(2); // One in text, one in citation list
    });

    it('should render citations list', () => {
      const parsedResponse = {
        text: 'Text with citation [1].',
        citations: [
          {
            id: 1,
            fileId: 'file-1',
            quote: 'Test quote from document',
            originalText: '【source:test.pdf】',
          },
        ],
      };

      render(<CitationParser parsedResponse={parsedResponse} />);

      expect(screen.getByText('Sources:')).toBeInTheDocument();
      expect(screen.getAllByText('[1]')).toHaveLength(2); // One in citation link, one in citation list
      expect(screen.getByText('Test quote from document')).toBeInTheDocument();
    });

    it('should handle text without citations gracefully', () => {
      const parsedResponse = {
        text: 'Text without citations.',
        citations: [],
      };

      render(<CitationParser parsedResponse={parsedResponse} />);

      expect(screen.getByText('Text without citations.')).toBeInTheDocument();
      expect(screen.queryByText('Sources:')).not.toBeInTheDocument();
    });
  });
});