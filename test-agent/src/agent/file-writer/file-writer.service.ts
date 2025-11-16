import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class FileWriterService {
  private readonly logger = new Logger(FileWriterService.name);
  private readonly e2eTestsPath: string;

  constructor(private readonly configService: ConfigService) {
    // Use absolute path from project root
    this.e2eTestsPath =
      this.configService.get<string>('E2E_TESTS_PATH') ||
      join(process.cwd(), '..', 'e2e-tests');
  }

  async writeTestFile(
    fileName: string,
    content: string,
  ): Promise<{ success: boolean; path: string; error?: string }> {
    const filePath = join(this.e2eTestsPath, 'tests', fileName);
    const dir = dirname(filePath);

    this.logger.log(`Writing test file: ${filePath}`);
    this.logger.debug(`File content length: ${content.length} characters`);

    try {
      // Ensure directory exists
      this.logger.debug(`Ensuring directory exists: ${dir}`);
      await mkdir(dir, { recursive: true });
      this.logger.debug('Directory ready');

      // Write file
      this.logger.debug('Writing file content to disk');
      await writeFile(filePath, content, 'utf-8');
      this.logger.log(`Test file written successfully: ${filePath}`);

      // Format with ESLint and Prettier
      this.logger.debug('Formatting file with ESLint and Prettier');
      await this.formatFile(filePath);

      this.logger.log(`Test file creation completed: ${filePath}`);
      return {
        success: true,
        path: filePath,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to write test file: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  }

  private async formatFile(filePath: string): Promise<void> {
    try {
      this.logger.debug(`Formatting file with ESLint: ${filePath}`);

      // Run ESLint with --fix
      const lintCommand = `cd "${this.e2eTestsPath}" && npm run lint -- --fix "${filePath}"`;
      this.logger.debug(`Executing ESLint: ${lintCommand}`);
      const lintStartTime = Date.now();
      await execAsync(lintCommand, {
        timeout: 30000,
      });
      const lintDuration = Date.now() - lintStartTime;

      this.logger.log(`File formatted with ESLint in ${lintDuration}ms`);
    } catch (error: any) {
      // ESLint might return non-zero exit code even after fixing
      // Check if file was actually formatted by checking stderr
      if (error.stderr && !error.stderr.includes('error')) {
        this.logger.log('File formatted (warnings may exist)');
        return;
      }

      this.logger.warn(`ESLint formatting had issues: ${error.message}`);
      this.logger.debug(`ESLint stderr: ${error.stderr?.substring(0, 200)}`);
      // Don't throw - file was written, formatting is optional
    }

    try {
      // Also run Prettier if available
      this.logger.debug('Formatting file with Prettier');
      const prettierCommand = `cd "${this.e2eTestsPath}" && npx prettier --write "${filePath}"`;
      const prettierStartTime = Date.now();
      await execAsync(prettierCommand, {
        timeout: 10000,
      });
      const prettierDuration = Date.now() - prettierStartTime;
      this.logger.log(`File formatted with Prettier in ${prettierDuration}ms`);
    } catch (error: any) {
      // Prettier might not be available or configured
      this.logger.debug(`Prettier formatting skipped: ${error.message}`);
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    const { existsSync } = await import('fs');
    const filePath = join(this.e2eTestsPath, 'tests', fileName);
    return existsSync(filePath);
  }
}
