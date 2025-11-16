import { Injectable, Logger } from '@nestjs/common';
import { EndpointInfo } from '../openapi/openapi.service';
import { MissingTest } from '../gap-analysis/gap-analysis.service';

export interface EnrichedEndpointInfo extends EndpointInfo {
  enrichedContext: {
    relatedEndpoints?: string[];
    complexity?: 'low' | 'medium' | 'high';
    testPriority?: 'high' | 'medium' | 'low';
    estimatedTestCases?: number;
    requiredTestScenarios?: string[];
    validationRules?: string[];
  };
}

export interface PreparedContext {
  endpoints: EnrichedEndpointInfo[];
  testPatterns: string;
  existingTestExamples: string;
  apiMetadata: {
    totalEndpoints: number;
    endpointsByMethod: Record<string, number>;
    endpointsByTag: Record<string, number>;
  };
}

@Injectable()
export class DataPreparationService {
  private readonly logger = new Logger(DataPreparationService.name);

  /**
   * Prepare and enrich data for test generation
   */
  async prepareContext(
    endpoints: EndpointInfo[],
    missingTests: MissingTest[],
    testPatterns: string,
    existingTestExamples: string,
  ): Promise<PreparedContext> {
    this.logger.log('Starting data preparation and contextualization');
    this.logger.log(`Processing ${endpoints.length} endpoints, ${missingTests.length} missing tests`);

    // Validate input data
    this.logger.log('Step 1: Validating input data');
    this.validateData(endpoints, missingTests, testPatterns);

    // Enrich endpoint information
    this.logger.log('Step 2: Enriching endpoint information');
    const enrichedEndpoints = await this.enrichEndpoints(endpoints, missingTests);

    // Calculate API metadata
    this.logger.log('Step 3: Calculating API metadata');
    const apiMetadata = this.calculateApiMetadata(endpoints);

    // Filter to only missing test endpoints
    const missingEndpointInfos = enrichedEndpoints.filter((ep) =>
      missingTests.some(
        (mt) => mt.endpoint === ep.path && mt.method === ep.method,
      ),
    );

    this.logger.log(
      `Data preparation completed: ${missingEndpointInfos.length} endpoints enriched`,
    );

    return {
      endpoints: missingEndpointInfos,
      testPatterns: this.cleanAndEnrichTestPatterns(testPatterns),
      existingTestExamples: this.cleanAndEnrichExamples(existingTestExamples),
      apiMetadata,
    };
  }

  /**
   * Validate input data quality
   */
  private validateData(
    endpoints: EndpointInfo[],
    missingTests: MissingTest[],
    testPatterns: string,
  ): void {
    this.logger.debug('Validating data quality');

    if (!endpoints || endpoints.length === 0) {
      this.logger.warn('No endpoints provided for validation');
      throw new Error('No endpoints available for test generation');
    }

    if (!missingTests || missingTests.length === 0) {
      this.logger.warn('No missing tests identified');
    }

    // Validate endpoint structure
    const invalidEndpoints = endpoints.filter(
      (ep) => !ep.path || !ep.method,
    );
    if (invalidEndpoints.length > 0) {
      this.logger.warn(
        `Found ${invalidEndpoints.length} endpoints with missing path or method`,
      );
    }

    // Validate test patterns
    if (!testPatterns || testPatterns.trim().length === 0) {
      this.logger.warn('No test patterns available - will use defaults');
    }

    this.logger.debug('Data validation completed');
  }

  /**
   * Enrich endpoint information with additional context
   */
  private async enrichEndpoints(
    endpoints: EndpointInfo[],
    missingTests: MissingTest[],
  ): Promise<EnrichedEndpointInfo[]> {
    this.logger.debug(`Enriching ${endpoints.length} endpoints`);

    return endpoints.map((endpoint) => {
      const enriched: EnrichedEndpointInfo = {
        ...endpoint,
        enrichedContext: {
          relatedEndpoints: this.findRelatedEndpoints(endpoint, endpoints),
          complexity: this.assessComplexity(endpoint),
          testPriority: this.assessTestPriority(endpoint, missingTests),
          estimatedTestCases: this.estimateTestCases(endpoint),
          requiredTestScenarios: this.identifyRequiredScenarios(endpoint),
          validationRules: this.extractValidationRules(endpoint),
        },
      };

      this.logger.debug(
        `Enriched endpoint ${endpoint.method} ${endpoint.path}: complexity=${enriched.enrichedContext.complexity}, priority=${enriched.enrichedContext.testPriority}`,
      );

      return enriched;
    });
  }

  /**
   * Find related endpoints (same resource, similar patterns)
   */
  private findRelatedEndpoints(
    endpoint: EndpointInfo,
    allEndpoints: EndpointInfo[],
  ): string[] {
    const basePath = endpoint.path.split('/').slice(0, -1).join('/');
    const related = allEndpoints
      .filter(
        (ep) =>
          ep.path.startsWith(basePath) &&
          ep.path !== endpoint.path &&
          ep.tags?.some((tag) => endpoint.tags?.includes(tag)),
      )
      .map((ep) => `${ep.method} ${ep.path}`)
      .slice(0, 5); // Limit to 5 related endpoints

    this.logger.debug(
      `Found ${related.length} related endpoints for ${endpoint.path}`,
    );
    return related;
  }

  /**
   * Assess endpoint complexity
   */
  private assessComplexity(endpoint: EndpointInfo): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Parameters increase complexity
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      complexityScore += endpoint.parameters.length;
    }

    // Multiple response codes increase complexity
    if (endpoint.responses) {
      const responseCount = Object.keys(endpoint.responses).length;
      complexityScore += responseCount > 2 ? 2 : 1;
    }

    // Path parameters increase complexity
    if (endpoint.path.includes('{') || endpoint.path.includes(':')) {
      complexityScore += 2;
    }

    // POST/PUT/PATCH are more complex
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      complexityScore += 2;
    }

    if (complexityScore <= 2) return 'low';
    if (complexityScore <= 5) return 'medium';
    return 'high';
  }

  /**
   * Assess test priority
   */
  private assessTestPriority(
    endpoint: EndpointInfo,
    missingTests: MissingTest[],
  ): 'high' | 'medium' | 'low' {
    const missingTest = missingTests.find(
      (mt) => mt.endpoint === endpoint.path && mt.method === endpoint.method,
    );

    if (!missingTest) return 'low';

    // Health endpoints are lower priority
    if (endpoint.path.includes('health')) return 'low';

    // GET endpoints are higher priority (most common)
    if (endpoint.method === 'GET') return 'high';

    // CRUD operations are high priority
    if (endpoint.tags?.some((tag) => ['users', 'api'].includes(tag.toLowerCase()))) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Estimate number of test cases needed
   */
  private estimateTestCases(endpoint: EndpointInfo): number {
    let baseCases = 2; // Happy path + one error case

    // Add cases for each response code
    if (endpoint.responses) {
      baseCases += Object.keys(endpoint.responses).length;
    }

    // Add cases for parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      baseCases += endpoint.parameters.length;
    }

    // Minimum 3, maximum 10 test cases
    return Math.min(Math.max(baseCases, 3), 10);
  }

  /**
   * Identify required test scenarios
   */
  private identifyRequiredScenarios(endpoint: EndpointInfo): string[] {
    const scenarios: string[] = [];

    // Always need happy path
    scenarios.push('Happy path - successful request');

    // Error scenarios based on responses
    if (endpoint.responses) {
      if (endpoint.responses['404']) {
        scenarios.push('Not found - 404 error');
      }
      if (endpoint.responses['400']) {
        scenarios.push('Bad request - 400 error');
      }
      if (endpoint.responses['401'] || endpoint.responses['403']) {
        scenarios.push('Authentication/Authorization - 401/403 error');
      }
      if (endpoint.responses['500']) {
        scenarios.push('Server error - 500 error');
      }
    }

    // Parameter validation scenarios
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      scenarios.push('Parameter validation - invalid parameters');
    }

    // Response validation
    scenarios.push('Response structure validation');

    this.logger.debug(
      `Identified ${scenarios.length} required scenarios for ${endpoint.path}`,
    );
    return scenarios;
  }

  /**
   * Extract validation rules from endpoint
   */
  private extractValidationRules(endpoint: EndpointInfo): string[] {
    const rules: string[] = [];

    if (endpoint.parameters) {
      endpoint.parameters.forEach((param: any) => {
        if (param.required) {
          rules.push(`${param.name} is required`);
        }
        if (param.schema?.type) {
          rules.push(`${param.name} must be of type ${param.schema.type}`);
        }
        if (param.schema?.minimum !== undefined) {
          rules.push(`${param.name} minimum value: ${param.schema.minimum}`);
        }
        if (param.schema?.maximum !== undefined) {
          rules.push(`${param.name} maximum value: ${param.schema.maximum}`);
        }
      });
    }

    return rules;
  }

  /**
   * Clean and enrich test patterns
   */
  private cleanAndEnrichTestPatterns(testPatterns: string): string {
    if (!testPatterns || testPatterns.trim().length === 0) {
      this.logger.warn('No test patterns provided, using default patterns');
      return this.getDefaultTestPatterns();
    }

    // Clean up the patterns
    let cleaned = testPatterns.trim();
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    this.logger.debug(`Cleaned test patterns, length: ${cleaned.length}`);
    return cleaned;
  }

  /**
   * Clean and enrich test examples
   */
  private cleanAndEnrichExamples(examples: string): string {
    if (!examples || examples.trim().length === 0) {
      this.logger.warn('No test examples provided');
      return '';
    }

    // Clean up examples
    let cleaned = examples.trim();
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    this.logger.debug(`Cleaned test examples, length: ${cleaned.length}`);
    return cleaned;
  }

  /**
   * Get default test patterns if none provided
   */
  private getDefaultTestPatterns(): string {
    return `Default Test Patterns:
- Use describe blocks to group related tests
- Use it() blocks for individual test cases
- Import request from 'supertest'
- Use API_BASE_URL environment variable
- Include happy path and error scenarios
- Validate response structure and status codes
- Use descriptive test names`;
  }

  /**
   * Calculate API metadata
   */
  private calculateApiMetadata(endpoints: EndpointInfo[]): {
    totalEndpoints: number;
    endpointsByMethod: Record<string, number>;
    endpointsByTag: Record<string, number>;
  } {
    const endpointsByMethod: Record<string, number> = {};
    const endpointsByTag: Record<string, number> = {};

    endpoints.forEach((endpoint) => {
      // Count by method
      endpointsByMethod[endpoint.method] =
        (endpointsByMethod[endpoint.method] || 0) + 1;

      // Count by tags
      if (endpoint.tags && endpoint.tags.length > 0) {
        endpoint.tags.forEach((tag) => {
          endpointsByTag[tag] = (endpointsByTag[tag] || 0) + 1;
        });
      }
    });

    this.logger.debug(
      `API metadata: ${endpoints.length} total endpoints, ${Object.keys(endpointsByMethod).length} methods, ${Object.keys(endpointsByTag).length} tags`,
    );

    return {
      totalEndpoints: endpoints.length,
      endpointsByMethod,
      endpointsByTag,
    };
  }
}

