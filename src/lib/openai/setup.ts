import { VectorStoreService } from '../../features/rag/VectorStoreService';

/**
 * Vector store setup utilities for OpenAI RAG integration
 */
export class VectorStoreSetup {
  private vectorStoreService: VectorStoreService;

  constructor() {
    this.vectorStoreService = new VectorStoreService();
  }

  /**
   * Create a vector store with sample documents for development
   */
  async setupDevelopmentVectorStore(): Promise<{ vectorStoreId: string; fileIds: string[] }> {
    try {
      // Create vector store
      const vectorStore = await this.vectorStoreService.createVectorStore('RoboRail Documentation');
      console.log(`Created vector store: ${vectorStore.id}`);

      // Sample document content for development
      const sampleDocuments = [
        {
          name: 'roborail-intro.txt',
          content: `RoboRail is an advanced autonomous railway system that provides safe, efficient, and reliable transportation.

Key Features:
- Autonomous operation with AI-powered control systems
- Real-time safety monitoring and hazard detection
- Energy-efficient electric propulsion
- Passenger comfort optimization
- Weather-adaptive scheduling

Technical Specifications:
- Maximum speed: 300 km/h
- Capacity: 500 passengers per train
- Energy efficiency: 95% regenerative braking
- Safety systems: Triple redundancy on critical components

The system uses advanced computer vision and machine learning algorithms to ensure safe operation in all weather conditions.`
        },
        {
          name: 'roborail-safety.txt',
          content: `RoboRail Safety Systems

Primary Safety Features:
1. Collision Avoidance System (CAS)
   - LiDAR and radar sensors
   - Computer vision obstacle detection
   - Emergency braking within 50 meters

2. Track Integrity Monitoring
   - Continuous track condition assessment
   - Predictive maintenance alerts
   - Real-time structural analysis

3. Weather Adaptation
   - Wind speed monitoring
   - Precipitation detection
   - Automatic speed adjustment

4. Passenger Safety
   - Emergency communication systems
   - Automated evacuation procedures
   - Medical emergency response protocols

Safety Record:
- Zero accidents in 500,000 km of testing
- 99.99% uptime reliability
- Average response time: 2.3 seconds for emergency stops`
        }
      ];

      const fileIds: string[] = [];

      // Upload sample documents
      for (const doc of sampleDocuments) {
        const file = new File([doc.content], doc.name, { type: 'text/plain' });
        const uploadResult = await this.vectorStoreService.uploadDocument(file, vectorStore.id);
        fileIds.push(uploadResult.id);
        console.log(`Uploaded document: ${doc.name} (${uploadResult.id})`);
      }

      console.log(`Vector store setup complete. Add this to your .env.local:`);
      console.log(`VECTOR_STORE_ID=${vectorStore.id}`);

      return {
        vectorStoreId: vectorStore.id,
        fileIds,
      };
    } catch (error) {
      console.error('Failed to setup vector store:', error);
      throw error;
    }
  }

  /**
   * Validate vector store configuration
   */
  async validateSetup(): Promise<boolean> {
    try {
      const vectorStoreId = this.vectorStoreService.getVectorStoreId();
      console.log(`Using vector store: ${vectorStoreId}`);
      return true;
    } catch (error) {
      console.error('Vector store validation failed:', error);
      return false;
    }
  }
}

/**
 * CLI utility for setting up vector store
 */
export async function setupVectorStore() {
  const setup = new VectorStoreSetup();
  
  try {
    const result = await setup.setupDevelopmentVectorStore();
    console.log('✅ Vector store setup successful!');
    console.log(`Vector Store ID: ${result.vectorStoreId}`);
    console.log(`Uploaded ${result.fileIds.length} sample documents`);
    return result;
  } catch (error) {
    console.error('❌ Vector store setup failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  setupVectorStore()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}