import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { TestResult } from '../test-runner/test-runner.service';
import { MissingTest } from '../gap-analysis/gap-analysis.service';
import { EndpointInfo } from '../openapi/openapi.service';

export interface ReflectionResult {
  shouldRetry: boolean;
  analysis: string;
  improvements: string[];
  updatedPrompt?: string;
  confidence: number; // 0-1 scale
}

export interface TestFailureAnalysis {
  failureType: 'syntax' | 'runtime' | 'assertion' | 'timeout' | 'unknown';
  rootCause: string;
  suggestedFixes: string[];
  canAutoFix: boolean;
}

@Injectable()
export class ReflectionService {
  private readonly logger = new Logger(ReflectionService.name);
  private readonly llm: ChatOpenAI;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
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
      temperature: 0.5, // Moderate temperature for reflection
    });

    this.maxRetries =
      parseInt(
        this.configService.get<string>('MAX_TEST_GENERATION_RETRIES') || '3',
        10,
      ) || 3;
  }

  /**
   * Reflect on test generation result and determine if retry is needed
   */
  async reflectOnTestResult(
    testResult: TestResult,
    testCode: string,
    endpoint: MissingTest,
    endpointInfo: EndpointInfo,
    attemptNumber: number,
  ): Promise<ReflectionResult> {
    this.logger.log(
      `Reflecting on test result for ${endpoint.method} ${endpoint.endpoint} (attempt ${attemptNumber})`,
    );

    if (testResult.success) {
      this.logger.log('Test passed - no reflection needed');
      return {
        shouldRetry: false,
        analysis: 'Test passed successfully',
        improvements: [],
        confidence: 1.0,
      };
    }

    this.logger.warn(
      `Test failed - analyzing failure (exit code: ${testResult.exitCode})`,
    );
    this.logger.debug(`Test output: ${testResult.output.substring(0, 500)}`);

    // Analyze the failure
    const failureAnalysis = this.analyzeFailure(testResult, testCode);

    // Use LLM for deeper reflection if needed
    if (attemptNumber < this.maxRetries) {
      const llmReflection = await this.performLLMReflection(
        testResult,
        testCode,
        endpoint,
        endpointInfo,
        failureAnalysis,
        attemptNumber,
      );

      return {
        shouldRetry: llmReflection.shouldRetry,
        analysis: llmReflection.analysis,
        improvements: llmReflection.improvements,
        updatedPrompt: llmReflection.updatedPrompt,
        confidence: llmReflection.confidence,
      };
    }

    // Max retries reached
    this.logger.warn(
      `Max retries (${this.maxRetries}) reached for ${endpoint.method} ${endpoint.endpoint}`,
    );
    return {
      shouldRetry: false,
      analysis: `Max retries reached. Failure type: ${failureAnalysis.failureType}`,
      improvements: failureAnalysis.suggestedFixes,
      confidence: 0.3,
    };
  }

  /**
   * Analyze test failure to categorize it
   */
  private analyzeFailure(
    testResult: TestResult,
    testCode: string,
  ): TestFailureAnalysis {
    this.logger.debug('Analyzing test failure type');

    const output = testResult.output.toLowerCase();
    const error = testResult.output;

    let failureType: TestFailureAnalysis['failureType'] = 'unknown';
    let rootCause = 'Unknown error';
    const suggestedFixes: string[] = [];
    let canAutoFix = false;

    // Syntax errors
    if (
      output.includes('syntax error') ||
      output.includes('parse error') ||
      output.includes('unexpected token') ||
      output.includes('cannot find name') ||
      output.includes('is not defined')
    ) {
      failureType = 'syntax';
      rootCause = 'Syntax or compilation error in generated test code';
      suggestedFixes.push('Fix import statements');
      suggestedFixes.push('Check variable declarations');
      suggestedFixes.push('Verify TypeScript syntax');
      canAutoFix = true;
      this.logger.debug('Identified syntax error');
    }
    // Runtime errors
    else if (
      output.includes('typeerror') ||
      output.includes('referenceerror') ||
      output.includes('cannot read property') ||
      output.includes('is not a function')
    ) {
      failureType = 'runtime';
      rootCause = 'Runtime error during test execution';
      suggestedFixes.push('Check API endpoint availability');
      suggestedFixes.push('Verify request/response handling');
      suggestedFixes.push('Check async/await usage');
      canAutoFix = true;
      this.logger.debug('Identified runtime error');
    }
    // Assertion failures
    else if (
      output.includes('expect') ||
      output.includes('assertion') ||
      output.includes('expected') ||
      output.includes('received')
    ) {
      failureType = 'assertion';
      rootCause = 'Test assertion failed - expected vs actual mismatch';
      suggestedFixes.push('Review expected response structure');
      suggestedFixes.push('Check response status codes');
      suggestedFixes.push('Verify response data format');
      canAutoFix = true;
      this.logger.debug('Identified assertion failure');
    }
    // Timeout errors
    else if (
      output.includes('timeout') ||
      output.includes('timed out') ||
      testResult.exitCode === 124
    ) {
      failureType = 'timeout';
      rootCause = 'Test execution timed out';
      suggestedFixes.push('Increase timeout duration');
      suggestedFixes.push('Check API server response time');
      suggestedFixes.push('Verify network connectivity');
      canAutoFix = false;
      this.logger.debug('Identified timeout error');
    }

    this.logger.debug(
      `Failure analysis: type=${failureType}, canAutoFix=${canAutoFix}`,
    );

    return {
      failureType,
      rootCause,
      suggestedFixes,
      canAutoFix,
    };
  }

  /**
   * Use LLM to reflect on failure and suggest improvements
   */
  private async performLLMReflection(
    testResult: TestResult,
    testCode: string,
    endpoint: MissingTest,
    endpointInfo: EndpointInfo,
    failureAnalysis: TestFailureAnalysis,
    attemptNumber: number,
  ): Promise<ReflectionResult> {
    this.logger.log('Performing LLM-based reflection on test failure');

    const prompt = `You are a test engineering expert analyzing a failed e2e test.

Test Context:
- Endpoint: ${endpoint.method} ${endpoint.endpoint}
- Summary: ${endpointInfo.summary || 'N/A'}
- Attempt: ${attemptNumber}/${this.maxRetries}

Generated Test Code:
\`\`\`typescript
${testCode.substring(0, 2000)}${testCode.length > 2000 ? '...' : ''}
\`\`\`

Test Failure Output:
${testResult.output.substring(0, 1500)}${testResult.output.length > 1500 ? '...' : ''}

Failure Analysis:
- Type: ${failureAnalysis.failureType}
- Root Cause: ${failureAnalysis.rootCause}
- Suggested Fixes: ${failureAnalysis.suggestedFixes.join(', ')}

Analyze this failure and provide:
1. A detailed analysis of what went wrong
2. Specific improvements to the test code
3. Whether a retry with fixes would likely succeed (confidence level)
4. If retrying, provide an improved prompt/guidance for regenerating the test

Return your response as JSON:
{
  "shouldRetry": true/false,
  "analysis": "detailed analysis",
  "improvements": ["improvement1", "improvement2"],
  "updatedPrompt": "improved prompt guidance",
  "confidence": 0.0-1.0
}

Return ONLY valid JSON, no additional text.`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in LLM reflection response');
        return this.getDefaultReflectionResult(failureAnalysis);
      }

      const reflection = JSON.parse(jsonMatch[0]) as ReflectionResult;
      this.logger.log(
        `LLM reflection: shouldRetry=${reflection.shouldRetry}, confidence=${reflection.confidence}`,
      );
      this.logger.debug(`Improvements: ${reflection.improvements.join(', ')}`);

      return reflection;
    } catch (error: any) {
      this.logger.error(`LLM reflection failed: ${error.message}`, error.stack);
      return this.getDefaultReflectionResult(failureAnalysis);
    }
  }

  /**
   * Get default reflection result when LLM fails
   */
  private getDefaultReflectionResult(
    failureAnalysis: TestFailureAnalysis,
  ): ReflectionResult {
    return {
      shouldRetry: failureAnalysis.canAutoFix,
      analysis: failureAnalysis.rootCause,
      improvements: failureAnalysis.suggestedFixes,
      confidence: failureAnalysis.canAutoFix ? 0.6 : 0.3,
    };
  }

  /**
   * Get max retries allowed
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }
}
