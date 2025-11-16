import { ragClient } from '../clients/rag-client';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('RagTool');

export interface RagToolInput {
  query: string;
  context?: string;
}

/**
 * RAG Tool for ReAct agent
 * Queries the NestJS RAG API for knowledge-based answers
 */
export const ragTool = {
  name: 'queryRAG',
  description: `Query the RAG (Retrieval-Augmented Generation) system for knowledge-based answers. 
  
USE THIS TOOL WHEN:
- User asks about technical documentation, stored knowledge, or specific domain information
- Question requires factual information that might be in a knowledge base
- User asks about previously indexed documents, PDFs, or text files
- Question is about databases, systems, or technical concepts that were documented

DO NOT USE THIS TOOL FOR:
- General knowledge questions (use direct LLM)
- Weather information (use getWeather tool)
- Project structure analysis (use analyzeProject tool)
- Simple greetings or conversational queries

INPUT FORMAT:
{
  "query": "What is vector database indexing?",
  "context": "optional additional context"
}

OUTPUT: Returns relevant information from the knowledge base with sources.`,
  
  execute: async ({ query, context }: RagToolInput) => {
    console.log(chalk.bold.magenta('\n🔧 [RAG TOOL] EXECUTING...'));
    console.log(chalk.gray(`   Query: ${query}`));
    if (context) {
      console.log(chalk.gray(`   Context: ${context}`));
    }

    const startTime = Date.now();
    
    logger.info('RAG query started', {
      query,
      hasContext: !!context,
    });

    try {
      const ragQuery = context ? `${query}\n\nContext: ${context}` : query;
      const ragResponse = await ragClient.queryRAG(ragQuery);
      const response = ragResponse.response;

      const duration = Date.now() - startTime;

      logger.info('RAG query completed', {
        duration,
        responseLength: response.length,
      });

      console.log(chalk.green(`\n✅ RAG query completed in ${(duration / 1000).toFixed(2)}s`));
      console.log(chalk.gray(`   Response length: ${response.length} characters\n`));

      return JSON.stringify({
        success: true,
        answer: response,
        duration: `${(duration / 1000).toFixed(2)}s`,
        source: 'RAG Knowledge Base',
      }, null, 2);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logger.error('RAG query failed', {
        duration,
        error: error.message,
      });

      console.error(chalk.red(`\n❌ RAG query failed: ${error.message}\n`));

      return JSON.stringify({
        success: false,
        error: `RAG query failed: ${error.message}`,
        suggestion: 'Try rephrasing the question or use a different tool.',
      });
    }
  },
};

