import { OpenAI } from 'openai';

export interface VectorStoreResult {
  id: string;
  name: string;
}

export interface DocumentUploadResult {
  id: string;
  filename: string;
}

export class VectorStoreService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async createVectorStore(name: string): Promise<VectorStoreResult> {
    try {
      const vectorStore = await this.openai.vectorStores.create({
        name,
        file_ids: [],
      });

      return {
        id: vectorStore.id,
        name: vectorStore.name || name,
      };
    } catch (error) {
      throw new Error(`Failed to create vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadDocument(file: File, vectorStoreId: string): Promise<DocumentUploadResult> {
    try {
      const fileResult = await this.openai.vectorStores.files.create(vectorStoreId, {
        file: file,
      });

      return {
        id: fileResult.id,
        filename: file.name,
      };
    } catch (error) {
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getVectorStoreId(): string {
    const vectorStoreId = process.env.VECTOR_STORE_ID;
    if (!vectorStoreId) {
      throw new Error('VECTOR_STORE_ID environment variable not set');
    }
    return vectorStoreId;
  }
}