import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

export interface TestResult {
  success: boolean;
  output: string;
  exitCode: number;
}

@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);
  private readonly e2eTestsPath: string;

  constructor(private readonly configService: ConfigService) {
    // Use absolute path from project root
    this.e2eTestsPath =
      this.configService.get<string>('E2E_TESTS_PATH') ||
      join(process.cwd(), '..', 'e2e-tests');
  }

  async runTest(testFileName: string): Promise<TestResult> {
    this.logger.log(`Running test file: ${testFileName}`);
    const startTime = Date.now();

    const testFilePath = `tests/${testFileName}`;
    const command = `cd "${this.e2eTestsPath}" && npm test -- ${testFilePath}`;

    try {
      this.logger.debug(`Executing test command: ${command}`);
      this.logger.debug(`Test file path: ${this.e2eTestsPath}/${testFilePath}`);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const duration = Date.now() - startTime;
      const output = stdout || stderr;

      this.logger.log(`Test execution completed successfully in ${duration}ms`);
      this.logger.debug(
        `Test output (first 500 chars): ${output.substring(0, 500)}`,
      );

      // Extract test results if available
      const passedMatch = output.match(/(\d+)\s+passed/i);
      const failedMatch = output.match(/(\d+)\s+failed/i);
      if (passedMatch || failedMatch) {
        this.logger.debug(
          `Test summary: ${passedMatch?.[1] || 0} passed, ${failedMatch?.[1] || 0} failed`,
        );
      }

      return {
        success: true,
        output,
        exitCode: 0,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const output = error.stdout || error.stderr || error.message;
      const exitCode = error.code || 1;

      this.logger.warn(
        `Test execution failed after ${duration}ms with exit code ${exitCode}`,
      );
      this.logger.debug(
        `Error output (first 1000 chars): ${output.substring(0, 1000)}`,
      );

      // Log specific error patterns
      if (output.includes('SyntaxError') || output.includes('TypeError')) {
        this.logger.error('Test file has syntax or type errors');
      }
      if (output.includes('timeout')) {
        this.logger.error('Test execution timed out');
      }

      return {
        success: false,
        output,
        exitCode,
      };
    }
  }

  async runAllTests(): Promise<TestResult> {
    this.logger.log('Running all e2e tests');
    const startTime = Date.now();

    const command = `cd "${this.e2eTestsPath}" && npm test`;

    try {
      this.logger.debug(`Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command, {
        timeout: 120000, // 2 minute timeout for all tests
        maxBuffer: 10 * 1024 * 1024,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`All tests completed in ${duration}ms`);

      return {
        success: true,
        output: stdout || stderr,
        exitCode: 0,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `All tests failed after ${duration}ms: ${error.message}`,
      );

      return {
        success: false,
        output: error.stdout || error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  async verifyTestFileExists(testFileName: string): Promise<boolean> {
    const { existsSync } = await import('fs');
    const testFilePath = join(this.e2eTestsPath, 'tests', testFileName);
    const exists = existsSync(testFilePath);
    this.logger.debug(
      `Test file ${testFileName} ${exists ? 'exists' : 'does not exist'} at ${testFilePath}`,
    );
    return exists;
  }
}
