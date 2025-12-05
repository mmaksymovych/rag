import axios, { AxiosInstance } from 'axios';
import { config } from '../utils/config';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('RAGClient');

export interface RAGQueryRequest {
  query: string;
  topK?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: {
    text: string;
    chunkId: number;
    sourceId: string;
    metadata: any;
  };
}

export interface RAGQueryResponse {
  response: string;
  context: SearchResult[];
  sources: string[];
}

export class RAGClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private endpoint: string;

  constructor() {
    this.baseUrl = config.rag.apiUrl;
    this.endpoint = config.rag.endpoint;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('RAG client initialized', {
      baseUrl: this.baseUrl,
      endpoint: this.endpoint,
    });
  }

  /**
   * Query the RAG system
   */
  async queryRAG(query: string, topK: number = 5): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    logger.debug('RAG query request', {
      queryLength: query.length,
      topK,
    });

    try {
      const response = await this.client.post<RAGQueryResponse>(this.endpoint, {
        query,
        topK,
      });

      const duration = Date.now() - startTime;
      logger.info('RAG query successful', {
        duration,
        responseLength: response.data.response.length,
        contextCount: response.data.context.length,
        sources: response.data.sources,
      });

      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error.response) {
        logger.error('RAG query failed with HTTP error', {
          duration,
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
        throw new Error(
          `RAG API error (${error.response.status}): ${error.response.statusText}`
        );
      } else if (error.request) {
        logger.error('RAG query failed - no response', {
          duration,
          error: error.message,
        });
        throw new Error('RAG API not responding. Is the NestJS API running?');
      } else {
        logger.error('RAG query failed', {
          duration,
          error: error.message,
        });
        throw new Error(`RAG query failed: ${error.message}`);
      }
    }
  }

  /**
   * Test connection to RAG API
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing RAG API connection...');
      
      // Try to hit the health endpoint or make a simple query
      const response = await this.client.get('/health', {
        timeout: 5000,
      });
      
      logger.info('RAG API connection successful');
      return true;
    } catch (error: any) {
      // If health endpoint doesn't exist, try a simple query
      try {
        await this.queryRAG('test', 1);
        logger.info('RAG API connection successful (via query)');
        return true;
      } catch (queryError: any) {
        logger.error('RAG API connection failed', {
          error: error.message,
          queryError: queryError.message,
        });
        return false;
      }
    }
  }

  /**
   * Get available models from RAG API
   */
  async getModels(): Promise<any> {
    try {
      const response = await this.client.get('/chat/models');
      logger.info('Retrieved RAG models', { models: response.data });
      return response.data;
    } catch (error: any) {
      logger.warn('Failed to get RAG models', { error: error.message });
      return null;
    }
  }
}

// Export singleton instance
export const ragClient = new RAGClient();

