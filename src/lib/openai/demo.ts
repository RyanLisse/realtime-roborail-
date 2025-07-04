#!/usr/bin/env npx tsx

/**
 * OpenAI RAG Integration Demo
 * 
 * This script demonstrates the complete RAG workflow:
 * 1. Create vector store with sample documents
 * 2. Generate responses with citations
 * 3. Parse and display citations
 */

import { RAGService } from './rag';
import { CitationUtils } from './citations';
import { VectorStoreSetup } from './setup';

async function runDemo() {
  console.log('🚀 OpenAI RAG Integration Demo\n');

  try {
    // Check environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Step 1: Setup vector store if needed
    console.log('📚 Setting up vector store...');
    const setup = new VectorStoreSetup();
    
    let vectorStoreId = process.env.VECTOR_STORE_ID;
    if (!vectorStoreId) {
      console.log('No VECTOR_STORE_ID found. Creating new vector store...');
      const result = await setup.setupDevelopmentVectorStore();
      vectorStoreId = result.vectorStoreId;
      console.log(`✅ Created vector store: ${vectorStoreId}\n`);
    } else {
      await setup.validateSetup();
      console.log(`✅ Using existing vector store: ${vectorStoreId}\n`);
    }

    // Step 2: Initialize RAG service
    console.log('🤖 Initializing RAG service...');
    const ragService = new RAGService({
      apiKey: process.env.OPENAI_API_KEY,
      vectorStoreId,
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });
    console.log('✅ RAG service initialized\n');

    // Step 3: Test queries
    const testQueries = [
      'What are the main safety features of RoboRail?',
      'How fast can RoboRail trains go?',
      'What makes RoboRail energy efficient?',
    ];

    for (const query of testQueries) {
      console.log(`❓ Query: "${query}"`);
      console.log('⏳ Generating response...\n');

      try {
        // Generate response with citations
        const result = await ragService.generateResponse({
          messages: [{ role: 'user', content: query }],
        });

        // Display response
        console.log('📝 Response:');
        console.log(result.text);
        console.log();

        // Display citations
        if (result.citations.length > 0) {
          console.log('📖 Sources:');
          result.citations.forEach(citation => {
            const formatted = CitationUtils.formatCitation(citation);
            console.log(`${formatted.display}`);
            console.log(`   "${citation.quote}"`);
            console.log();
          });
        } else {
          console.log('ℹ️  No citations found for this query\n');
        }

        console.log('---\n');
      } catch (error) {
        console.error(`❌ Error generating response: ${error.message}\n`);
      }
    }

    // Step 4: Test search functionality
    console.log('🔍 Testing document search...');
    try {
      const searchResults = await ragService.searchDocuments('collision avoidance', 3);
      console.log(`Found ${searchResults.length} relevant citations:`);
      
      searchResults.forEach((citation, index) => {
        console.log(`${index + 1}. "${citation.quote}"`);
      });
      console.log();
    } catch (error) {
      console.error(`❌ Search error: ${error.message}\n`);
    }

    // Step 5: Display configuration
    console.log('⚙️  Configuration:');
    const config = ragService.getConfiguration();
    console.log(`   Model: ${config.model}`);
    console.log(`   Temperature: ${config.temperature}`);
    console.log(`   Max Tokens: ${config.maxTokens}`);
    console.log(`   Citations: ${config.enableCitations ? 'Enabled' : 'Disabled'}`);
    console.log(`   Vector Store: ${config.vectorStoreId}`);
    console.log();

    console.log('✅ Demo completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Add more documents to your vector store');
    console.log('2. Integrate with your chat interface');
    console.log('3. Customize the UI components');
    console.log('4. Monitor usage and costs in OpenAI dashboard');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure OPENAI_API_KEY is set in your environment');
    console.error('2. Check your OpenAI account has sufficient credits');
    console.error('3. Verify internet connectivity');
    console.error('4. Review the logs above for specific error details');
    process.exit(1);
  }
}

// Run demo if called directly
if (require.main === module) {
  runDemo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Demo crashed:', error);
      process.exit(1);
    });
}

export { runDemo };