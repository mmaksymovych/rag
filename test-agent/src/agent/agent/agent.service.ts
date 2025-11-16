import { Injectable, Logger } from '@nestjs/common';
import { OpenApiService, EndpointInfo } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';
import { GapAnalysisService, MissingTest } from '../gap-analysis/gap-analysis.service';
import { DataPreparationService, PreparedContext } from '../data-preparation/data-preparation.service';
import { ReflectionService } from '../reflection/reflection.service';
import { TestGeneratorService } from '../test-generator/test-generator.service';
import { TestRunnerService, TestResult } from '../test-runner/test-runner.service';
import { FileWriterService } from '../file-writer/file-writer.service';

export interface GenerationResult {
  success: boolean;
  message: string;
  generatedTests: GeneratedTest[];
  errors?: string[];
}

export interface GeneratedTest {
  endpoint: string;
  method: string;
  fileName: string;
  filePath: string;
  testGenerated: boolean;
  testPassed: boolean;
  isStable?: boolean; // True if test passed 3 consecutive runs
  stabilityRuns?: number; // Number of successful stability runs
  totalAttempts?: number; // Total generation attempts
  error?: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly openApiService: OpenApiService,
    private readonly ragService: RagService,
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly dataPreparationService: DataPreparationService,
    private readonly reflectionService: ReflectionService,
    private readonly testGeneratorService: TestGeneratorService,
    private readonly testRunnerService: TestRunnerService,
    private readonly fileWriterService: FileWriterService,
  ) { }

  async generateTests(): Promise<GenerationResult> {
    this.logger.log('Starting test generation workflow');

    const result: GenerationResult = {
      success: true,
      message: 'Test generation completed',
      generatedTests: [],
      errors: [],
    };

    try {
      // Step 1: Verify OpenAPI server is running
      this.logger.log('Step 1: Verifying OpenAPI server is running');
      const serverRunning = await this.openApiService.verifyServerRunning();
      if (!serverRunning) {
        throw new Error(
          'OpenAPI server is not running. Please start the server before generating tests.',
        );
      }
      this.logger.log('OpenAPI server is running');

      // Step 2: Find missing tests
      this.logger.log('Step 2: Analyzing gaps to find missing tests');
      const missingTests = await this.gapAnalysisService.findMissingTests();
      this.logger.log(`Found ${missingTests.length} endpoints with missing tests`);

      if (missingTests.length === 0) {
        result.message = 'No missing tests found. All endpoints have test coverage.';
        return result;
      }

      // Step 3: Get test patterns and examples from RAG
      this.logger.log('Step 3: Querying RAG for test patterns and examples');
      const testPatterns = await this.ragService.queryTestPatterns();
      const existingTestExamples = await this.getExistingTestExamples();

      // Step 3.5: Prepare and enrich data
      this.logger.log('Step 3.5: Preparing and enriching data context');
      const allEndpoints = await this.openApiService.getEndpoints();
      const preparedContext = await this.dataPreparationService.prepareContext(
        allEndpoints,
        missingTests,
        testPatterns,
        existingTestExamples,
      );
      this.logger.log(
        `Data preparation complete: ${preparedContext.endpoints.length} endpoints enriched, API has ${preparedContext.apiMetadata.totalEndpoints} total endpoints`,
      );

      // Step 4: Generate tests for each missing endpoint with reflection loop
      this.logger.log(
        `Step 4: Generating tests for ${missingTests.length} endpoints with reflection and retry`,
      );

      for (const missingTest of missingTests) {
        try {
          const generatedTest = await this.generateTestWithReflection(
            missingTest,
            preparedContext,
          );
          result.generatedTests.push(generatedTest);

          if (!generatedTest.testGenerated || !generatedTest.testPassed || !generatedTest.isStable) {
            result.success = false;
            if (generatedTest.error) {
              result.errors?.push(
                `${missingTest.method} ${missingTest.endpoint}: ${generatedTest.error}`,
              );
            }
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to generate test for ${missingTest.method} ${missingTest.endpoint}: ${error.message}`,
            error.stack,
          );
          result.success = false;
          result.errors?.push(
            `${missingTest.method} ${missingTest.endpoint}: ${error.message}`,
          );
          result.generatedTests.push({
            endpoint: missingTest.endpoint,
            method: missingTest.method,
            fileName: this.testGeneratorService.generateTestFileName(
              missingTest.endpoint,
            ),
            filePath: '',
            testGenerated: false,
            testPassed: false,
            isStable: false,
            stabilityRuns: 0,
            totalAttempts: 0,
            error: error.message,
          });
        }
      }

      const successCount = result.generatedTests.filter(
        (t) => t.testGenerated && t.testPassed && t.isStable,
      ).length;
      const unstableCount = result.generatedTests.filter(
        (t) => t.testGenerated && t.testPassed && !t.isStable,
      ).length;

      if (unstableCount > 0) {
        result.message = `Generated ${successCount}/${missingTests.length} stable tests. ${unstableCount} tests are unstable (non-deterministic).`;
      } else {
        result.message = `Generated ${successCount}/${missingTests.length} stable tests successfully`;
      }

      this.logger.log(`Workflow completed: ${result.message}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Workflow failed: ${error.message}`, error.stack);
      result.success = false;
      result.message = `Test generation failed: ${error.message}`;
      result.errors?.push(error.message);
      return result;
    }
  }

  /**
   * Generate test with reflection and retry loop
   */
  private async generateTestWithReflection(
    missingTest: MissingTest,
    preparedContext: PreparedContext,
  ): Promise<GeneratedTest> {
    this.logger.log(
      `[${missingTest.method} ${missingTest.endpoint}] Starting test generation with reflection loop`,
    );

    // Get endpoint details
    const endpointInfo = await this.gapAnalysisService.getEndpointDetails(
      missingTest.endpoint,
      missingTest.method,
    );

    if (!endpointInfo) {
      throw new Error(
        `Endpoint ${missingTest.method} ${missingTest.endpoint} not found in OpenAPI spec`,
      );
    }

    // Find enriched endpoint info
    const enrichedEndpoint = preparedContext.endpoints.find(
      (ep) => ep.path === missingTest.endpoint && ep.method === missingTest.method,
    );

    const maxRetries = this.reflectionService.getMaxRetries();
    let testCode = '';
    let fileName = '';
    let writeResult: { success: boolean; path: string; error?: string } | null = null;
    let testResult: TestResult | null = null;
    let attemptNumber = 0;
    let lastReflection: any = null;

    // Retry loop with reflection
    while (attemptNumber < maxRetries) {
      attemptNumber++;
      this.logger.log(
        `[${missingTest.method} ${missingTest.endpoint}] Attempt ${attemptNumber}/${maxRetries}`,
      );

      try {
        // Generate test code (use reflection improvements if available)
        this.logger.debug(
          `[${missingTest.method} ${missingTest.endpoint}] Generating test code`,
        );
        testCode = await this.testGeneratorService.generateTestSuite(
          missingTest,
          enrichedEndpoint || endpointInfo,
          preparedContext.existingTestExamples,
          preparedContext.testPatterns,
          lastReflection?.updatedPrompt,
        );

        // Generate filename
        fileName = this.testGeneratorService.generateTestFileName(
          missingTest.endpoint,
        );

        // Write test file
        this.logger.debug(
          `[${missingTest.method} ${missingTest.endpoint}] Writing test file: ${fileName}`,
        );
        writeResult = await this.fileWriterService.writeTestFile(
          fileName,
          testCode,
        );

        if (!writeResult.success) {
          throw new Error(
            `Failed to write test file: ${writeResult.error || 'Unknown error'}`,
          );
        }

        // Run the test to verify it works
        this.logger.debug(
          `[${missingTest.method} ${missingTest.endpoint}] Running test to verify`,
        );
        testResult = await this.testRunnerService.runTest(fileName);

        // Reflect on the result
        this.logger.log(
          `[${missingTest.method} ${missingTest.endpoint}] Reflecting on test result`,
        );
        lastReflection = await this.reflectionService.reflectOnTestResult(
          testResult,
          testCode,
          missingTest,
          endpointInfo,
          attemptNumber,
        );

        this.logger.log(
          `[${missingTest.method} ${missingTest.endpoint}] Reflection: shouldRetry=${lastReflection.shouldRetry}, confidence=${lastReflection.confidence}`,
        );
        this.logger.debug(
          `[${missingTest.method} ${missingTest.endpoint}] Analysis: ${lastReflection.analysis}`,
        );

        // If test passed, break the loop
        if (testResult.success) {
          this.logger.log(
            `[${missingTest.method} ${missingTest.endpoint}] Test passed on attempt ${attemptNumber}`,
          );
          break;
        }

        // If reflection says don't retry, break
        if (!lastReflection.shouldRetry) {
          this.logger.warn(
            `[${missingTest.method} ${missingTest.endpoint}] Reflection suggests not retrying`,
          );
          break;
        }

        // If we're not at max retries, continue loop
        if (attemptNumber < maxRetries) {
          this.logger.log(
            `[${missingTest.method} ${missingTest.endpoint}] Retrying with improvements: ${lastReflection.improvements.join(', ')}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `[${missingTest.method} ${missingTest.endpoint}] Error on attempt ${attemptNumber}: ${error.message}`,
          error.stack,
        );

        // Create a mock test result for reflection
        testResult = {
          success: false,
          output: error.message,
          exitCode: 1,
        };

        lastReflection = await this.reflectionService.reflectOnTestResult(
          testResult,
          testCode || '',
          missingTest,
          endpointInfo,
          attemptNumber,
        );

        if (!lastReflection.shouldRetry || attemptNumber >= maxRetries) {
          throw error;
        }
      }
    }

    // Final result after generation attempts
    const initialSuccess = testResult?.success || false;

    if (!initialSuccess || !testCode || !fileName) {
      // Test generation failed completely
      return {
        endpoint: missingTest.endpoint,
        method: missingTest.method,
        fileName: fileName || this.testGeneratorService.generateTestFileName(missingTest.endpoint),
        filePath: writeResult?.path || '',
        testGenerated: !!testCode,
        testPassed: false,
        isStable: false,
        stabilityRuns: 0,
        totalAttempts: attemptNumber,
        error: testResult?.output || lastReflection?.analysis || 'Test generation failed',
      };
    }

    // Test passed initial generation - now verify stability (run 3 times)
    this.logger.log(
      `[${missingTest.method} ${missingTest.endpoint}] Initial test passed, verifying stability (3 runs required)`,
    );

    const stabilityResult = await this.verifyTestStability(
      fileName,
      testCode,
      missingTest,
      endpointInfo,
      attemptNumber,
    );

    // Add test to RAG only if it's stable (passed 3 consecutive runs)
    if (stabilityResult.isStable && testCode && fileName) {
      this.logger.log(
        `[${missingTest.method} ${missingTest.endpoint}] Test is stable, adding to RAG`,
      );
      try {
        await this.ragService.addTestToRag(
          fileName,
          testCode,
          missingTest.endpoint,
          missingTest.method,
        );
        this.logger.log(
          `[${missingTest.method} ${missingTest.endpoint}] Test added to RAG successfully`,
        );
      } catch (error: any) {
        this.logger.warn(
          `[${missingTest.method} ${missingTest.endpoint}] Failed to add test to RAG (non-critical): ${error.message}`,
        );
      }
    }

    return {
      endpoint: missingTest.endpoint,
      method: missingTest.method,
      fileName,
      filePath: writeResult?.path || '',
      testGenerated: true,
      testPassed: stabilityResult.isStable,
      isStable: stabilityResult.isStable,
      stabilityRuns: stabilityResult.successfulRuns,
      totalAttempts: attemptNumber + stabilityResult.fixAttempts,
      error: stabilityResult.isStable ? undefined : stabilityResult.error,
    };
  }

  /**
   * Verify test stability by running it 3 times
   * If it fails, attempt to fix it
   */
  private async verifyTestStability(
    fileName: string,
    testCode: string,
    missingTest: MissingTest,
    endpointInfo: EndpointInfo,
    initialAttempts: number,
  ): Promise<{
    isStable: boolean;
    successfulRuns: number;
    fixAttempts: number;
    error?: string;
  }> {
    const requiredStableRuns = 3;
    const maxFixAttempts = 3;
    let successfulRuns = 0;
    let fixAttempts = 0;
    let currentTestCode = testCode;
    let lastFailure: TestResult | null = null;

    this.logger.log(
      `[${missingTest.method} ${missingTest.endpoint}] Starting stability verification (${requiredStableRuns} runs required)`,
    );

    // Run test 3 times to verify stability
    for (let runNumber = 1; runNumber <= requiredStableRuns; runNumber++) {
      this.logger.log(
        `[${missingTest.method} ${missingTest.endpoint}] Stability run ${runNumber}/${requiredStableRuns}`,
      );

      const testResult = await this.testRunnerService.runTest(fileName);

      if (testResult.success) {
        successfulRuns++;
        this.logger.log(
          `[${missingTest.method} ${missingTest.endpoint}] Stability run ${runNumber} passed (${successfulRuns}/${requiredStableRuns} successful)`,
        );
      } else {
        this.logger.warn(
          `[${missingTest.method} ${missingTest.endpoint}] Stability run ${runNumber} failed - test is non-deterministic`,
        );
        lastFailure = testResult;

        // If we haven't exceeded max fix attempts, try to fix
        if (fixAttempts < maxFixAttempts) {
          fixAttempts++;
          this.logger.log(
            `[${missingTest.method} ${missingTest.endpoint}] Attempting to fix non-deterministic test (fix attempt ${fixAttempts}/${maxFixAttempts})`,
          );

          // Reflect on the failure
          const reflection = await this.reflectionService.reflectOnTestResult(
            testResult,
            currentTestCode,
            missingTest,
            endpointInfo,
            initialAttempts + fixAttempts,
          );

          if (reflection.shouldRetry && reflection.updatedPrompt) {
            // Regenerate test with improvements
            this.logger.debug(
              `[${missingTest.method} ${missingTest.endpoint}] Regenerating test with stability improvements`,
            );

            try {
              const enrichedEndpoint = await this.gapAnalysisService.getEndpointDetails(
                missingTest.endpoint,
                missingTest.method,
              );

              if (enrichedEndpoint) {
                // Get fresh context for regeneration
                const testPatterns = await this.ragService.queryTestPatterns();
                const existingTestExamples = await this.getExistingTestExamples();

                // Regenerate with stability-focused improvements
                const stabilityPrompt = `${reflection.updatedPrompt}\n\nIMPORTANT: This test failed on a subsequent run, indicating non-deterministic behavior. Ensure the test is stable and handles timing, async operations, and potential race conditions properly.`;

                currentTestCode = await this.testGeneratorService.generateTestSuite(
                  missingTest,
                  enrichedEndpoint,
                  existingTestExamples,
                  testPatterns,
                  stabilityPrompt,
                );

                // Rewrite the test file
                const writeResult = await this.fileWriterService.writeTestFile(
                  fileName,
                  currentTestCode,
                );

                if (!writeResult.success) {
                  this.logger.error(
                    `[${missingTest.method} ${missingTest.endpoint}] Failed to rewrite test file: ${writeResult.error}`,
                  );
                  break;
                }

                this.logger.log(
                  `[${missingTest.method} ${missingTest.endpoint}] Test regenerated, will retry stability verification`,
                );

                // Reset run counter and start over
                successfulRuns = 0;
                runNumber = 0; // Will be incremented to 1 in next iteration
                continue;
              }
            } catch (error: any) {
              this.logger.error(
                `[${missingTest.method} ${missingTest.endpoint}] Failed to regenerate test: ${error.message}`,
                error.stack,
              );
            }
          } else {
            this.logger.warn(
              `[${missingTest.method} ${missingTest.endpoint}] Reflection suggests not retrying fix`,
            );
          }
        } else {
          this.logger.error(
            `[${missingTest.method} ${missingTest.endpoint}] Max fix attempts (${maxFixAttempts}) reached. Test is unstable.`,
          );
          break;
        }
      }

      // Small delay between runs to avoid timing issues
      if (runNumber < requiredStableRuns && testResult.success) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const isStable = successfulRuns === requiredStableRuns;

    if (isStable) {
      this.logger.log(
        `[${missingTest.method} ${missingTest.endpoint}] Test verified as stable (${successfulRuns}/${requiredStableRuns} runs passed)`,
      );
    } else {
      this.logger.error(
        `[${missingTest.method} ${missingTest.endpoint}] Test is unstable: only ${successfulRuns}/${requiredStableRuns} runs passed after ${fixAttempts} fix attempts`,
      );
    }

    return {
      isStable,
      successfulRuns,
      fixAttempts,
      error: isStable ? undefined : lastFailure?.output || 'Test failed stability verification',
    };
  }

  private async generateTestForEndpoint(
    missingTest: MissingTest,
    testPatterns: string,
    existingTestExamples: string,
  ): Promise<GeneratedTest> {
    // Legacy method - kept for backward compatibility
    // This is now handled by generateTestWithReflection
    throw new Error('This method is deprecated. Use generateTestWithReflection instead.');
  }

  private async getExistingTestExamples(): Promise<string> {
    try {
      // Query RAG for existing test code examples
      const examples = await this.ragService.queryRag(
        'Provide complete code examples of existing e2e test files. Include the full test file structure, imports, and test cases.',
        3,
      );
      return examples;
    } catch (error: any) {
      this.logger.warn(`Failed to get test examples from RAG: ${error.message}`);
      return '';
    }
  }
}

