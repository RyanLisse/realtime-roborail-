import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CitationCard } from '@/components/citations/CitationCard';
import { CitationSourceModal } from '@/components/citations/CitationSourceModal';
import { useModal } from '@/components/ui/Modal';
import { citationTestScenarios, createMockFetch, resetCitationMocks } from '../utils/citationMocks';

// Mock dependencies
vi.mock('@/lib/openai/citations', () => ({
  CitationUtils: {
    formatCitation: vi.fn((citation) => ({
      id: citation.id,
      display: citation.filename 
        ? `[${citation.id}] ${citation.filename}${citation.pageNumber ? `, page ${citation.pageNumber}` : ''}`
        : `[${citation.id}] ${citation.fileId}`,
      quote: citation.quote,
      source: citation.filename || citation.fileId,
    })),
  },
}));

vi.mock('@/components/ui/Modal', async () => {
  const actual = await vi.importActual('@/components/ui/Modal');
  return {
    ...actual,
    Modal: ({ children, isOpen, onClose, title }: any) => {
      if (!isOpen) return null;
      return (
        <div data-testid="modal" role="dialog" aria-label={title}>
          <button onClick={onClose} data-testid="modal-close">×</button>
          <h1>{title}</h1>
          {children}
        </div>
      );
    },
  };
});

// Mock react-dom createPortal
vi.mock('react-dom', () => ({
  createPortal: (children: React.ReactNode) => children,
}));

describe('Citation System Integration', () => {
  let mockFetch: any;

  beforeEach(() => {
    resetCitationMocks();
    mockFetch = createMockFetch();
    global.fetch = mockFetch;
    
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    resetCitationMocks();
    vi.clearAllMocks();
  });

  it('should display citation card and open modal on click', async () => {
    const { citation, sourceContent } = citationTestScenarios.singleCitation;
    const user = userEvent.setup();

    // Component that integrates citation card with modal
    function CitationWithModal() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationWithModal />);

    // Verify citation card is displayed
    expect(screen.getByText('[1] intro.pdf, page 1')).toBeInTheDocument();
    expect(screen.getByText('"RoboRail is an advanced railway management system"')).toBeInTheDocument();
    expect(screen.getByText('Source: intro.pdf')).toBeInTheDocument();

    // Click on citation card
    await user.click(screen.getByRole('button'));

    // Verify modal opens and fetches content
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    expect(screen.getByText('Source Content')).toBeInTheDocument();
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Citation Details')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/getSource?fileId=file-intro-123&pageNumber=1&contextLines=5',
      expect.objectContaining({
        headers: {
          'Authorization': 'Bearer user-session-key',
        },
      })
    );
  });

  it('should handle multiple citations with different file types', async () => {
    const { citations } = citationTestScenarios.multipleCitations;
    const user = userEvent.setup();

    function MultipleCitations() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          {citations.map((citation) => (
            <CitationCard
              key={citation.id}
              citation={citation}
              onClick={handleCitationClick}
            />
          ))}
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<MultipleCitations />);

    // Verify both citation cards are displayed
    expect(screen.getByText('[1] intro.pdf, page 1')).toBeInTheDocument();
    expect(screen.getByText('[2] safety-manual.pdf, page 15')).toBeInTheDocument();

    // Click on first citation
    const firstCard = screen.getByRole('button', { name: /citation 1/i });
    await user.click(firstCard);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Close modal
    await user.click(screen.getByTestId('modal-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    // Click on second citation
    const secondCard = screen.getByRole('button', { name: /citation 2/i });
    await user.click(secondCard);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Should fetch different file
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/getSource?fileId=file-safety-456&pageNumber=15&contextLines=5',
      expect.any(Object)
    );
  });

  it('should handle citation without page number', async () => {
    const { citation } = citationTestScenarios.citationWithoutPage;
    const user = userEvent.setup();

    function CitationWithoutPage() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationWithoutPage />);

    // Verify citation card shows without page number
    expect(screen.getByText('[4] technical-spec.txt')).toBeInTheDocument();
    expect(screen.queryByText('Page')).not.toBeInTheDocument();

    // Click citation
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Should fetch without page parameter
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/getSource?fileId=file-technical-spec&contextLines=5',
      expect.any(Object)
    );
  });

  it('should handle API errors gracefully', async () => {
    const { citation } = citationTestScenarios.nonExistentFile;
    const user = userEvent.setup();

    // Override fetch to return error
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found',
        },
      }),
    });

    function CitationWithError() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationWithError />);

    // Click citation
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Error loading source')).toBeInTheDocument();
    });

    expect(screen.getByText('File not found')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should handle network errors', async () => {
    const { citation } = citationTestScenarios.singleCitation;
    const user = userEvent.setup();

    // Override fetch to reject
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    function CitationWithNetworkError() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationWithNetworkError />);

    // Click citation
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Error loading source')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load source content')).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    const { citation } = citationTestScenarios.singleCitation;
    const user = userEvent.setup();

    function CitationKeyboardTest() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationKeyboardTest />);

    const card = screen.getByRole('button');

    // Test Enter key
    card.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Close with Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    // Test Space key
    await user.keyboard(' ');

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('should maintain proper accessibility attributes', async () => {
    const { citation } = citationTestScenarios.singleCitation;
    const user = userEvent.setup();

    function AccessibleCitation() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<AccessibleCitation />);

    const card = screen.getByRole('button');
    
    // Check accessibility attributes
    expect(card).toHaveAttribute('aria-label', 'Citation 1: intro.pdf. Click to view source');
    expect(card).toHaveAttribute('tabIndex', '0');

    // Open modal
    await user.click(card);

    await waitFor(() => {
      const modal = screen.getByTestId('modal');
      expect(modal).toHaveAttribute('role', 'dialog');
      expect(modal).toHaveAttribute('aria-label', 'Source Content');
    });
  });

  it('should handle download functionality', async () => {
    const { citation } = citationTestScenarios.singleCitation;
    const user = userEvent.setup();

    // Mock document methods
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

    function CitationWithDownload() {
      const modal = useModal();
      const [selectedCitation, setSelectedCitation] = React.useState(null);

      const handleCitationClick = (citation: any) => {
        setSelectedCitation(citation);
        modal.openModal();
      };

      return (
        <div>
          <CitationCard
            citation={citation}
            onClick={handleCitationClick}
          />
          <CitationSourceModal
            citation={selectedCitation}
            isOpen={modal.isOpen}
            onClose={modal.closeModal}
          />
        </div>
      );
    }

    render(<CitationWithDownload />);

    // Click citation to open modal
    await user.click(screen.getByRole('button'));

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    });

    // Click download button
    await user.click(screen.getByText('Download'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    // Restore original methods
    document.createElement = originalCreateElement;
  });

  it('should handle dark mode styling', () => {
    const { citation } = citationTestScenarios.singleCitation;

    // Add dark class to document
    document.documentElement.classList.add('dark');

    function DarkModeCitation() {
      const modal = useModal();
      return (
        <div>
          <CitationCard citation={citation} onClick={vi.fn()} />
        </div>
      );
    }

    render(<DarkModeCitation />);

    const card = screen.getByRole('button');
    
    // Check that dark mode classes are applied
    expect(card).toHaveClass('dark:bg-gray-800');
    expect(card).toHaveClass('dark:hover:border-blue-600');

    // Clean up
    document.documentElement.classList.remove('dark');
  });
});