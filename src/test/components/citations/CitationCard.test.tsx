import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationCard } from '@/components/citations/CitationCard';
import { Citation } from '@/lib/openai/types';

// Mock CitationUtils
vi.mock('@/lib/openai/citations', () => ({
  CitationUtils: {
    formatCitation: vi.fn(),
  },
}));

import { CitationUtils } from '@/lib/openai/citations';

describe('CitationCard', () => {
  const mockCitation: Citation = {
    id: 1,
    fileId: 'file-123',
    quote: 'This is a test quote from the document',
    originalText: '【source:test.pdf】',
    filename: 'test.pdf',
    pageNumber: 5,
  };

  const mockFormattedCitation = {
    id: 1,
    display: '[1] test.pdf, page 5',
    quote: 'This is a test quote from the document',
    source: 'test.pdf',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (CitationUtils.formatCitation as any).mockReturnValue(mockFormattedCitation);
  });

  it('should render citation card with all content', () => {
    render(<CitationCard citation={mockCitation} />);

    expect(screen.getByText('[1] test.pdf, page 5')).toBeInTheDocument();
    expect(screen.getByText('"This is a test quote from the document"')).toBeInTheDocument();
    expect(screen.getByText('Source: test.pdf')).toBeInTheDocument();
    expect(screen.getByText('Page 5')).toBeInTheDocument();
  });

  it('should render without quote when showQuote is false', () => {
    render(<CitationCard citation={mockCitation} showQuote={false} />);

    expect(screen.getByText('[1] test.pdf, page 5')).toBeInTheDocument();
    expect(screen.queryByText('"This is a test quote from the document"')).not.toBeInTheDocument();
    expect(screen.getByText('Source: test.pdf')).toBeInTheDocument();
  });

  it('should render without page number when not provided', () => {
    const citationWithoutPage = {
      ...mockCitation,
      pageNumber: undefined,
    };

    const formattedWithoutPage = {
      ...mockFormattedCitation,
      display: '[1] test.pdf',
    };

    (CitationUtils.formatCitation as any).mockReturnValue(formattedWithoutPage);

    render(<CitationCard citation={citationWithoutPage} />);

    expect(screen.getByText('[1] test.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Page')).not.toBeInTheDocument();
  });

  it('should handle click when onClick is provided', async () => {
    const mockOnClick = vi.fn();
    const user = userEvent.setup();

    render(<CitationCard citation={mockCitation} onClick={mockOnClick} />);

    const card = screen.getByRole('button');
    await user.click(card);

    expect(mockOnClick).toHaveBeenCalledWith(mockCitation);
  });

  it('should handle keyboard interaction when onClick is provided', async () => {
    const mockOnClick = vi.fn();

    render(<CitationCard citation={mockCitation} onClick={mockOnClick} />);

    const card = screen.getByRole('button');
    
    // Test Enter key
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledWith(mockCitation);

    // Test Space key
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
  });

  it('should not handle keyboard events for non-trigger keys', async () => {
    const mockOnClick = vi.fn();
    const user = userEvent.setup();

    render(<CitationCard citation={mockCitation} onClick={mockOnClick} />);

    const card = screen.getByRole('button');
    
    // Test other keys that shouldn't trigger
    fireEvent.keyDown(card, { key: 'Tab' });
    fireEvent.keyDown(card, { key: 'Escape' });
    fireEvent.keyDown(card, { key: 'a' });

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should render as article when onClick is not provided', () => {
    render(<CitationCard citation={mockCitation} />);

    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render as button when onClick is provided', () => {
    const mockOnClick = vi.fn();

    render(<CitationCard citation={mockCitation} onClick={mockOnClick} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('should show external link icon when onClick is provided', () => {
    const mockOnClick = vi.fn();

    render(<CitationCard citation={mockCitation} onClick={mockOnClick} />);

    const icon = screen.getByRole('button').querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('should not show external link icon when onClick is not provided', () => {
    render(<CitationCard citation={mockCitation} />);

    const card = screen.getByRole('article');
    const icon = card.querySelector('svg');
    expect(icon).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<CitationCard citation={mockCitation} className="custom-class" />);

    const card = screen.getByRole('article');
    expect(card).toHaveClass('custom-class');
  });

  it('should have correct tabIndex based on onClick prop', () => {
    // With onClick
    const { rerender } = render(
      <CitationCard citation={mockCitation} onClick={vi.fn()} />
    );
    
    let card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');

    // Without onClick
    rerender(<CitationCard citation={mockCitation} />);
    
    card = screen.getByRole('article');
    expect(card).toHaveAttribute('tabIndex', '-1');
  });

  it('should have correct aria-label', () => {
    // With onClick
    const { rerender } = render(
      <CitationCard citation={mockCitation} onClick={vi.fn()} />
    );
    
    let card = screen.getByRole('button');
    expect(card).toHaveAttribute(
      'aria-label',
      'Citation 1: test.pdf. Click to view source'
    );

    // Without onClick
    rerender(<CitationCard citation={mockCitation} />);
    
    card = screen.getByRole('article');
    expect(card).toHaveAttribute('aria-label', 'Citation 1: test.pdf');
  });

  it('should apply hover styles when clickable', () => {
    const { rerender } = render(
      <CitationCard citation={mockCitation} onClick={vi.fn()} />
    );
    
    let card = screen.getByRole('button');
    expect(card).toHaveClass('cursor-pointer');
    expect(card).toHaveClass('hover:border-blue-300');
    expect(card).toHaveClass('dark:hover:border-blue-600');

    // Without onClick - should not have hover styles
    rerender(<CitationCard citation={mockCitation} />);
    
    card = screen.getByRole('article');
    expect(card).not.toHaveClass('cursor-pointer');
    expect(card).not.toHaveClass('hover:border-blue-300');
    expect(card).not.toHaveClass('dark:hover:border-blue-600');
  });

  it('should call CitationUtils.formatCitation with correct citation', () => {
    render(<CitationCard citation={mockCitation} />);

    expect(CitationUtils.formatCitation).toHaveBeenCalledWith(mockCitation);
  });

  it('should render correct structure and CSS classes', () => {
    render(<CitationCard citation={mockCitation} />);

    const card = screen.getByRole('article');
    expect(card).toHaveClass('citation-card');
    expect(card).toHaveClass('p-3');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('rounded-lg');
    expect(card).toHaveClass('bg-white');
    expect(card).toHaveClass('dark:bg-gray-800');
    expect(card).toHaveClass('shadow-sm');
    expect(card).toHaveClass('hover:shadow-md');
    expect(card).toHaveClass('transition-all');
    expect(card).toHaveClass('duration-200');

    // Check header structure
    const header = card.querySelector('.citation-header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('items-center');
    expect(header).toHaveClass('justify-between');
    expect(header).toHaveClass('mb-2');

    // Check citation ID styling
    const citationId = card.querySelector('.citation-id');
    expect(citationId).toBeInTheDocument();
    expect(citationId).toHaveClass('font-semibold');
    expect(citationId).toHaveClass('text-blue-600');
    expect(citationId).toHaveClass('dark:text-blue-400');

    // Check quote section
    const quote = card.querySelector('.citation-quote');
    expect(quote).toBeInTheDocument();

    const blockquote = quote?.querySelector('blockquote');
    expect(blockquote).toHaveClass('text-gray-700');
    expect(blockquote).toHaveClass('dark:text-gray-300');
    expect(blockquote).toHaveClass('text-sm');
    expect(blockquote).toHaveClass('italic');
    expect(blockquote).toHaveClass('border-l-4');
    expect(blockquote).toHaveClass('border-blue-200');
    expect(blockquote).toHaveClass('dark:border-blue-600');
    expect(blockquote).toHaveClass('pl-3');

    // Check source section
    const source = card.querySelector('.citation-source');
    expect(source).toBeInTheDocument();
    expect(source).toHaveClass('mt-2');
    expect(source).toHaveClass('text-xs');
    expect(source).toHaveClass('text-gray-500');
    expect(source).toHaveClass('dark:text-gray-400');
  });

  it('should handle missing optional properties gracefully', () => {
    const minimalCitation: Citation = {
      id: 2,
      fileId: 'file-456',
      quote: 'Minimal quote',
      originalText: '【source】',
    };

    const minimalFormatted = {
      id: 2,
      display: '[2] file-456',
      quote: 'Minimal quote',
      source: 'file-456',
    };

    (CitationUtils.formatCitation as any).mockReturnValue(minimalFormatted);

    render(<CitationCard citation={minimalCitation} />);

    expect(screen.getByText('[2] file-456')).toBeInTheDocument();
    expect(screen.getByText('"Minimal quote"')).toBeInTheDocument();
    expect(screen.getByText('Source: file-456')).toBeInTheDocument();
    expect(screen.queryByText('Page')).not.toBeInTheDocument();
  });
});