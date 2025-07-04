import { describe, it, expect } from 'vitest';
import { CitationUtils } from '../../../lib/openai/citations';
import { CitationError } from '../../../lib/openai/types';

describe('CitationUtils', () => {
  describe('parseCitations', () => {
    it('should parse citations from text with annotations', () => {
      const text = 'RoboRail is a railway system 【source:intro.pdf】 that provides efficient transportation.';
      const annotations = [
        {
          type: 'file_citation' as const,
          text: '【source:intro.pdf】',
          start_index: 29,
          end_index: 47,
          file_citation: {
            file_id: 'file-12345',
            quote: 'RoboRail is an advanced railway system',
          },
        },
      ];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result).toEqual({
        text: 'RoboRail is a railway system [1] that provides efficient transportation.',
        citations: [
          {
            id: 1,
            fileId: 'file-12345',
            quote: 'RoboRail is an advanced railway system',
            originalText: '【source:intro.pdf】',
            filename: undefined,
            pageNumber: undefined,
          },
        ],
      });
    });

    it('should handle multiple citations', () => {
      const text = 'RoboRail 【source:intro.pdf】 offers safety features 【source:safety.pdf】.';
      const annotations = [
        {
          type: 'file_citation' as const,
          text: '【source:intro.pdf】',
          start_index: 9,
          end_index: 27,
          file_citation: {
            file_id: 'file-12345',
            quote: 'RoboRail introduction',
          },
        },
        {
          type: 'file_citation' as const,
          text: '【source:safety.pdf】',
          start_index: 51,
          end_index: 70,
          file_citation: {
            file_id: 'file-67890',
            quote: 'safety features description',
          },
        },
      ];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result).toEqual({
        text: 'RoboRail [1] offers safety features [2].',
        citations: [
          {
            id: 1,
            fileId: 'file-12345',
            quote: 'RoboRail introduction',
            originalText: '【source:intro.pdf】',
            filename: undefined,
            pageNumber: undefined,
          },
          {
            id: 2,
            fileId: 'file-67890',
            quote: 'safety features description',
            originalText: '【source:safety.pdf】',
            filename: undefined,
            pageNumber: undefined,
          },
        ],
      });
    });

    it('should handle text without citations', () => {
      const text = 'This is a simple text without citations.';
      const annotations: any[] = [];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result).toEqual({
        text: 'This is a simple text without citations.',
        citations: [],
      });
    });

    it('should handle overlapping citations gracefully', () => {
      const text = 'RoboRail 【source:intro.pdf】【source:overview.pdf】 is efficient.';
      const annotations = [
        {
          type: 'file_citation' as const,
          text: '【source:intro.pdf】',
          start_index: 9,
          end_index: 30,
          file_citation: {
            file_id: 'file-12345',
            quote: 'RoboRail introduction',
          },
        },
        {
          type: 'file_citation' as const,
          text: '【source:overview.pdf】',
          start_index: 30,
          end_index: 54,
          file_citation: {
            file_id: 'file-67890',
            quote: 'RoboRail overview',
          },
        },
      ];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result.citations).toHaveLength(2);
      expect(result.text).toContain('[1]');
      expect(result.text).toContain('[2]');
    });

    it('should filter out non-file-citation annotations', () => {
      const text = 'RoboRail 【source:intro.pdf】 is efficient.';
      const annotations = [
        {
          type: 'file_citation' as const,
          text: '【source:intro.pdf】',
          start_index: 9,
          end_index: 30,
          file_citation: {
            file_id: 'file-12345',
            quote: 'RoboRail introduction',
          },
        },
        {
          type: 'other_annotation' as any,
          text: 'other',
          start_index: 35,
          end_index: 40,
        },
      ];

      const result = CitationUtils.parseCitations(text, annotations);

      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].fileId).toBe('file-12345');
    });
  });

  describe('formatCitation', () => {
    it('should format citation with all fields', () => {
      const citation = {
        id: 1,
        fileId: 'file-12345',
        quote: 'RoboRail is an advanced railway system',
        originalText: '【source:intro.pdf】',
        filename: 'intro.pdf',
        pageNumber: 5,
      };

      const result = CitationUtils.formatCitation(citation);

      expect(result).toEqual({
        id: 1,
        display: '[1] intro.pdf, page 5',
        quote: 'RoboRail is an advanced railway system',
        source: 'intro.pdf',
      });
    });

    it('should format citation without page number', () => {
      const citation = {
        id: 2,
        fileId: 'file-67890',
        quote: 'safety features description',
        originalText: '【source:safety.pdf】',
        filename: 'safety.pdf',
      };

      const result = CitationUtils.formatCitation(citation);

      expect(result).toEqual({
        id: 2,
        display: '[2] safety.pdf',
        quote: 'safety features description',
        source: 'safety.pdf',
      });
    });

    it('should format citation without filename', () => {
      const citation = {
        id: 3,
        fileId: 'file-unknown',
        quote: 'some content',
        originalText: '【source:unknown】',
      };

      const result = CitationUtils.formatCitation(citation);

      expect(result).toEqual({
        id: 3,
        display: '[3] file-unknown',
        quote: 'some content',
        source: 'file-unknown',
      });
    });
  });

  describe('extractSourceInfo', () => {
    it('should return undefined for standard file IDs', () => {
      const fileId = 'file-intro-pdf';
      const result = CitationUtils.extractSourceInfo(fileId);

      expect(result).toEqual({
        filename: undefined,
        pageNumber: undefined,
      });
    });

    it('should return undefined for file IDs with page info', () => {
      const fileId = 'file-intro-pdf-page-5';
      const result = CitationUtils.extractSourceInfo(fileId);

      expect(result).toEqual({
        filename: undefined,
        pageNumber: undefined,
      });
    });

    it('should return undefined for complex file IDs', () => {
      const fileId = 'file-robo-rail-user-manual-v2-pdf';
      const result = CitationUtils.extractSourceInfo(fileId);

      expect(result).toEqual({
        filename: undefined,
        pageNumber: undefined,
      });
    });

    it('should handle invalid file IDs gracefully', () => {
      const fileId = 'invalid-file-id';
      const result = CitationUtils.extractSourceInfo(fileId);

      expect(result).toEqual({
        filename: undefined,
        pageNumber: undefined,
      });
    });
  });

  describe('validateCitation', () => {
    it('should validate complete citation', () => {
      const citation = {
        id: 1,
        fileId: 'file-12345',
        quote: 'RoboRail is an advanced railway system',
        originalText: '【source:intro.pdf】',
      };

      expect(() => CitationUtils.validateCitation(citation)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const citation = {
        id: 1,
        fileId: '',
        quote: 'RoboRail is an advanced railway system',
        originalText: '【source:intro.pdf】',
      };

      expect(() => CitationUtils.validateCitation(citation)).toThrow(CitationError);
    });

    it('should throw error for invalid ID', () => {
      const citation = {
        id: 0,
        fileId: 'file-12345',
        quote: 'RoboRail is an advanced railway system',
        originalText: '【source:intro.pdf】',
      };

      expect(() => CitationUtils.validateCitation(citation)).toThrow(CitationError);
    });
  });
});