import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorStoreService } from './VectorStoreService';
import { mockOpenAI, resetMocks } from '../../test/mockOpenAI';

vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => mockOpenAI),
}));

describe('VectorStoreService', () => {
  let vectorStoreService: VectorStoreService;

  beforeEach(() => {
    resetMocks();
    vectorStoreService = new VectorStoreService();
  });

  describe('createVectorStore', () => {
    it('should create a vector store with the given name', async () => {
      const name = 'Test RoboRail Docs';
      const result = await vectorStoreService.createVectorStore(name);

      expect(mockOpenAI.vectorStores.create).toHaveBeenCalledWith({
        name,
        file_ids: [],
      });

      expect(result).toEqual({
        id: 'test-vector-store-id',
        name: 'Test Vector Store',
      });
    });

    it('should handle vector store creation errors', async () => {
      const errorMessage = 'API Error';
      mockOpenAI.vectorStores.create.mockRejectedValue(new Error(errorMessage));

      await expect(vectorStoreService.createVectorStore('Test')).rejects.toThrow(
        `Failed to create vector store: ${errorMessage}`
      );
    });
  });

  describe('uploadDocument', () => {
    it('should upload a document to the vector store', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const vectorStoreId = 'test-vector-store-id';

      const result = await vectorStoreService.uploadDocument(file, vectorStoreId);

      expect(mockOpenAI.vectorStores.files.create).toHaveBeenCalledWith(
        vectorStoreId,
        expect.objectContaining({
          file: expect.any(File),
        })
      );

      expect(result).toEqual({
        id: 'test-file-id',
        filename: 'test.pdf',
      });
    });

    it('should handle document upload errors', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const vectorStoreId = 'test-vector-store-id';
      const errorMessage = 'Upload failed';

      mockOpenAI.vectorStores.files.create.mockRejectedValue(new Error(errorMessage));

      await expect(vectorStoreService.uploadDocument(file, vectorStoreId)).rejects.toThrow(
        `Failed to upload document: ${errorMessage}`
      );
    });
  });

  describe('getVectorStoreId', () => {
    it('should return the configured vector store ID', () => {
      const result = vectorStoreService.getVectorStoreId();
      expect(result).toBe('test-vector-store-id');
    });
  });
});