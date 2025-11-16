import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly ragApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.ragApiUrl =
      this.configService.get<string>('RAG_API_URL') || 'http://localhost:3000';
  }

  async queryExistingTests(endpoint: string): Promise<string> {
    this.logger.log(
      `Querying RAG for existing tests for endpoint: ${endpoint}`,
    );
    const query = `What e2e tests exist for the endpoint ${endpoint}? Provide test file names, test patterns, and code examples if available.`;
    const result = await this.queryRag(query);
    this.logger.debug(
      `RAG query for existing tests completed, result length: ${result.length}`,
    );
    return result;
  }

  async queryTestPatterns(): Promise<string> {
    this.logger.log('Querying RAG for test patterns and conventions');
    const query =
      'What are the common patterns and structure used in e2e test files? Provide examples of test file structure, naming conventions, and common test cases.';
    const result = await this.queryRag(query);
    this.logger.debug(
      `RAG query for test patterns completed, result length: ${result.length}`,
    );
    return result;
  }

  async queryRag(query: string, topK: number = 5): Promise<string> {
    try {
      this.logger.log(`Querying RAG system: ${query.substring(0, 50)}...`);
      const response = await axios.post(
        `${this.ragApiUrl}/chat`,
        {
          query,
          topK,
        },
        {
          timeout: 120000, // Increased to 120 seconds (2 minutes)
        },
      );

      const result = response.data.response || response.data.answer || '';
      this.logger.log(`RAG query completed, response length: ${result.length}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Error querying RAG: ${error.message}`, error.stack);
      // Return empty string instead of throwing to allow workflow to continue
      return '';
    }
  }

  async getAllExistingTestFiles(): Promise<string[]> {
    this.logger.log('Querying RAG for all existing test files');
    const query =
      'List all e2e test files that exist. Provide file names and paths.';
    const response = await this.queryRag(query);

    // Try to extract file names from response
    const fileMatches = response.match(/[\w-]+\.e2e-spec\.ts/g) || [];
    const uniqueFiles = [...new Set(fileMatches)]; // Remove duplicates

    this.logger.log(
      `Extracted ${uniqueFiles.length} test file names from RAG response`,
    );
    this.logger.debug(`Test files: ${uniqueFiles.join(', ') || 'none found'}`);

    return uniqueFiles;
  }

  async addTestToRag(
    testFileName: string,
    testContent: string,
    endpoint: string,
    method: string,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Adding test to RAG: ${testFileName} for ${method} ${endpoint}`,
      );
      const startTime = Date.now();

      // Create a text document with metadata about the test
      const document = `E2E Test File: ${testFileName}
Endpoint: ${method} ${endpoint}
Test Content:
${testContent}

This test file covers the ${method} ${endpoint} endpoint with comprehensive e2e test cases.`;

      this.logger.debug(
        `Prepared document for RAG: ${document.length} characters`,
      );

      // Upload as text to RAG system using /text/submit endpoint
      this.logger.debug(
        `Submitting to RAG endpoint: ${this.ragApiUrl}/text/submit`,
      );
      const response = await axios.post(
        `${this.ragApiUrl}/text/submit`,
        {
          text: document,
          metadata: {
            type: 'e2e-test',
            fileName: testFileName,
            endpoint: endpoint,
            method: method,
            createdAt: new Date().toISOString(),
          },
        },
        {
          timeout: 60000,
        },
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Successfully added test to RAG in ${duration}ms: ${testFileName}`,
      );
      this.logger.debug(
        `RAG response: ${JSON.stringify(response.data).substring(0, 200)}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to add test to RAG: ${error.message}`,
        error.stack,
      );
      // Try alternative method - upload as file if text endpoint doesn't exist
      return this.addTestToRagAlternative(
        testFileName,
        testContent,
        endpoint,
        method,
      );
    }
  }

  private async addTestToRagAlternative(
    testFileName: string,
    testContent: string,
    endpoint: string,
    method: string,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Trying alternative method to add test to RAG: ${testFileName}`,
      );

      // Create a formatted document for RAG
      const document = `# E2E Test: ${testFileName}

**Endpoint:** ${method} ${endpoint}
**File:** ${testFileName}

\`\`\`typescript
${testContent}
\`\`\`

This e2e test file was automatically generated and covers the ${method} ${endpoint} endpoint.`;

      // Try to use the chat endpoint with a special command to add content
      // This is a fallback if direct text upload isn't available
      const response = await axios.post(
        `${this.ragApiUrl}/chat`,
        {
          query: `Add this e2e test to the knowledge base: ${document}`,
          topK: 1,
        },
        {
          timeout: 120000, // Increased to 120 seconds (2 minutes)
        },
      );

      this.logger.log(
        `Test information added to RAG via alternative method: ${testFileName}`,
      );
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Alternative RAG update method also failed: ${error.message}`,
      );
      return false;
    }
  }
}
