import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationSourceModal } from '@/components/citations/CitationSourceModal';
import { Citation } from '@/lib/openai/types';

// Mock the Modal component
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen, onClose, title }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <button onClick={onClose} data-testid="modal-close">Close</button>
        <h1>{title}</h1>
        {children}
      </div>
    );
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('CitationSourceModal', () => {
  const mockCitation: Citation = {
    id: 1,
    fileId: 'file-123',
    quote: 'This is a test quote from the document',
    originalText: '【source:test.pdf】',
    filename: 'test.pdf',
    pageNumber: 5,
  };

  const mockSourceContent = {
    fileId: 'file-123',
    filename: 'test-document.pdf',
    content: 'This is the main content of the document that was cited.',
    metadata: {
      pageNumber: 5,
      totalPages: 10,
      mimeType: 'application/pdf',
      size: 2048,
      createdAt: '2022-01-01T00:00:00.000Z',
    },
    context: {
      before: 'This is the content before the citation.',
      after: 'This is the content after the citation.',
      startLine: 45,
      endLine: 47,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should render when open with citation', () => {
    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Source Content')).toBeInTheDocument();
  });

  it('should not fetch when citation is null', () => {
    render(
      <CitationSourceModal
        citation={null}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch source content when modal opens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockSourceContent,
      }),
    });

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/getSource?fileId=file-123&pageNumber=5&contextLines=5',
        {
          headers: {
            'Authorization': 'Bearer user-session-key',
          },
        }
      );
    });
  });

  it('should display loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Loading source content...')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // spinner
  });

  it('should display source content when loaded successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockSourceContent,
      }),
    });

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Citation Details')).toBeInTheDocument();
    });

    // Check citation details
    expect(screen.getByText('"This is a test quote from the document"')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Page number

    // Check source metadata
    expect(screen.getByText('Source File')).toBeInTheDocument();
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1/1/2022')).toBeInTheDocument();

    // Check content sections
    expect(screen.getByText('Context Before')).toBeInTheDocument();
    expect(screen.getByText('This is the content before the citation.')).toBeInTheDocument();
    
    expect(screen.getByText('Source Content')).toBeInTheDocument();
    expect(screen.getByText('This is the main content of the document that was cited.')).toBeInTheDocument();
    
    expect(screen.getByText('Context After')).toBeInTheDocument();
    expect(screen.getByText('This is the content after the citation.')).toBeInTheDocument();

    // Check line numbers
    expect(screen.getByText('Lines 45 - 47')).toBeInTheDocument();
    expect(screen.getByText('Page 5 of 10')).toBeInTheDocument();
  });

  it('should display error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: false,
        error: {
          message: 'File not found',
        },
      }),
    });

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading source')).toBeInTheDocument();
    });

    expect(screen.getByText('File not found')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading source')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load source content')).toBeInTheDocument();
  });

  it('should retry fetching when try again is clicked', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockSourceContent,
        }),
      });

    const user = userEvent.setup();

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    // Click try again
    await user.click(screen.getByText('Try again'));

    // Should show success content
    await waitFor(() => {
      expect(screen.getByText('Citation Details')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle download functionality', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockSourceContent,
      }),
    });

    // Mock document.createElement and appendChild/removeChild
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tagName) => {
      if (tagName === 'a') return mockLink as any;
      return originalCreateElement.call(document, tagName);
    });

    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    document.body.appendChild = mockAppendChild;
    document.body.removeChild = mockRemoveChild;

    const user = userEvent.setup();

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    // Click download button
    await user.click(screen.getByText('Download'));

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(
      expect.any(Blob)
    );
    expect(mockLink.download).toBe('test-document.pdf');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
    expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    // Restore original methods
    document.createElement = originalCreateElement;
  });

  it('should display fallback when no source content available', () => {
    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Since we're not mocking fetch to resolve, it should show fallback
    expect(screen.getByText('No source content available')).toBeInTheDocument();
    expect(screen.getByText('Unable to retrieve source content for this citation.')).toBeInTheDocument();
  });

  it('should clear state when modal closes and reopens', async () => {
    const { rerender } = render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Close modal
    rerender(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    // Reopen modal
    rerender(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Should not show previous error or content
    expect(screen.queryByText('Error loading source')).not.toBeInTheDocument();
  });

  it('should handle citation without pageNumber', async () => {
    const citationWithoutPage = {
      ...mockCitation,
      pageNumber: undefined,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          ...mockSourceContent,
          metadata: {
            ...mockSourceContent.metadata,
            pageNumber: undefined,
          },
        },
      }),
    });

    render(
      <CitationSourceModal
        citation={citationWithoutPage}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/getSource?fileId=file-123&contextLines=5',
        expect.any(Object)
      );
    });
  });

  it('should format file sizes correctly', async () => {
    const testCases = [
      { size: 512, expected: '512.0 B' },
      { size: 1536, expected: '1.5 KB' },
      { size: 2097152, expected: '2.0 MB' },
      { size: 1073741824, expected: '1.0 GB' },
    ];

    for (const { size, expected } of testCases) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...mockSourceContent,
            metadata: {
              ...mockSourceContent.metadata,
              size,
            },
          },
        }),
      });

      const { unmount } = render(
        <CitationSourceModal
          citation={mockCitation}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(expected)).toBeInTheDocument();
      });

      unmount();
      vi.clearAllMocks();
    }
  });

  it('should call onClose when modal close button is clicked', async () => {
    const mockOnClose = vi.fn();
    const user = userEvent.setup();

    render(
      <CitationSourceModal
        citation={mockCitation}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByTestId('modal-close'));

    expect(mockOnClose).toHaveBeenCalled();
  });
});