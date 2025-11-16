import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { OpenApiService, EndpointInfo } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';

export interface MissingTest {
  endpoint: string;
  method: string;
  reason: string;
}

@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);
  private readonly llm: ChatOpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly openApiService: OpenApiService,
    private readonly ragService: RagService,
  ) {
    const apiUrl =
      this.configService.get<string>('LM_STUDIO_API_URL') ||
      'http://127.0.0.1:1234/v1';
    const model =
      this.configService.get<string>('LM_STUDIO_MODEL') ||
      'google/gemma-3n-e4b';

    this.llm = new ChatOpenAI({
      modelName: model,
      configuration: {
        baseURL: apiUrl,
      },
      temperature: 0.3, // Lower temperature for more consistent analysis
    });
  }

  async findMissingTests(): Promise<MissingTest[]> {
    this.logger.log('Starting gap analysis to find missing tests');
    const startTime = Date.now();

    // Get all endpoints from OpenAPI
    this.logger.debug('Fetching endpoints from OpenAPI spec');
    const endpoints = await this.openApiService.getEndpoints();
    this.logger.log(`Found ${endpoints.length} endpoints in OpenAPI spec`);
    this.logger.debug(
      `Endpoints by method: ${JSON.stringify(
        endpoints.reduce((acc, ep) => {
          acc[ep.method] = (acc[ep.method] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      )}`,
    );

    // Get existing test information from RAG
    this.logger.debug('Querying RAG for existing test files');
    const existingTestsInfo = await this.ragService.getAllExistingTestFiles();
    this.logger.log(
      `Found ${existingTestsInfo.length} existing test files in RAG: ${existingTestsInfo.join(', ') || 'none'}`,
    );

    this.logger.debug('Querying RAG for test patterns');
    const testPatterns = await this.ragService.queryTestPatterns();
    this.logger.debug(
      `Retrieved test patterns, length: ${testPatterns.length} characters`,
    );

    // Use LLM to analyze gaps
    this.logger.log('Analyzing gaps using LLM');
    const missingTests = await this.analyzeGapsWithLLM(
      endpoints,
      existingTestsInfo,
      testPatterns,
    );

    const duration = Date.now() - startTime;
    this.logger.log(
      `Gap analysis completed in ${duration}ms: Found ${missingTests.length} endpoints with missing tests`,
    );

    if (missingTests.length > 0) {
      this.logger.debug(
        `Missing tests: ${missingTests.map((mt) => `${mt.method} ${mt.endpoint}`).join(', ')}`,
      );
    }

    return missingTests;
  }

  private async analyzeGapsWithLLM(
    endpoints: EndpointInfo[],
    existingTestFiles: string[],
    testPatterns: string,
  ): Promise<MissingTest[]> {
    const endpointsSummary = endpoints
      .map((ep) => `${ep.method} ${ep.path} (${ep.summary || 'No summary'})`)
      .join('\n');

    const existingTestsSummary = existingTestFiles.length > 0
      ? existingTestFiles.join(', ')
      : 'No existing test files found';

    const prompt = `You are analyzing an API to identify which endpoints are missing e2e tests.

OpenAPI Endpoints:
${endpointsSummary}

Existing Test Files:
${existingTestsSummary}

Test Patterns Context:
${testPatterns || 'No test patterns available'}

Analyze which endpoints from the OpenAPI spec do NOT have corresponding e2e tests. 
For each missing test, provide:
1. The endpoint path
2. The HTTP method
3. A brief reason why this test is needed

Return your response as a JSON array of objects with this structure:
[
  {
    "endpoint": "/path/to/endpoint",
    "method": "GET",
    "reason": "Brief explanation"
  }
]

Only include endpoints that are truly missing tests. If an endpoint likely has a test (based on naming patterns), exclude it.
Return ONLY valid JSON, no additional text.`;

    try {
      this.logger.log('Querying LLM for gap analysis');
      this.logger.debug(`Prompt length: ${prompt.length} characters`);
      const llmStartTime = Date.now();

      const response = await this.llm.invoke(prompt);
      const llmDuration = Date.now() - llmStartTime;
      const content = response.content as string;

      this.logger.debug(
        `LLM response received in ${llmDuration}ms, length: ${content.length} characters`,
      );

      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in LLM response');
        this.logger.debug(`LLM response preview: ${content.substring(0, 200)}`);
        return [];
      }

      const missingTests = JSON.parse(jsonMatch[0]) as MissingTest[];
      this.logger.log(
        `LLM identified ${missingTests.length} missing tests in ${llmDuration}ms`,
      );
      this.logger.debug(
        `Missing tests details: ${JSON.stringify(missingTests, null, 2)}`,
      );
      return missingTests;
    } catch (error: any) {
      this.logger.error(
        `Error in LLM gap analysis: ${error.message}`,
        error.stack,
      );
      // Fallback: return all endpoints as missing if LLM fails
      return endpoints.map((ep) => ({
        endpoint: ep.path,
        method: ep.method,
        reason: 'LLM analysis failed, assuming test is missing',
      }));
    }
  }

  async getEndpointDetails(endpoint: string, method: string): Promise<EndpointInfo | null> {
    return this.openApiService.getEndpointByPathAndMethod(endpoint, method);
  }
}

