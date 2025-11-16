import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { EndpointInfo } from '../openapi/openapi.service';
import { MissingTest } from '../gap-analysis/gap-analysis.service';

@Injectable()
export class TestGeneratorService {
    private readonly logger = new Logger(TestGeneratorService.name);
    private readonly llm: ChatOpenAI;
    private readonly apiBaseUrl: string;

    constructor(private readonly configService: ConfigService) {
        const apiUrl =
            this.configService.get<string>('LM_STUDIO_API_URL') ||
            'http://127.0.0.1:1234/v1';
        const model =
            this.configService.get<string>('LM_STUDIO_MODEL') ||
            'google/gemma-3n-e4b';

        this.apiBaseUrl =
            this.configService.get<string>('OPENAPI_PROJECT_URL') ||
            'http://localhost:3001';

        this.llm = new ChatOpenAI({
            modelName: model,
            configuration: {
                baseURL: apiUrl,
            },
            temperature: 0.7,
        });
    }

    async generateTestSuite(
        missingTest: MissingTest,
        endpointInfo: EndpointInfo,
        existingTestExamples: string,
        testPatterns: string,
        reflectionImprovements?: string,
    ): Promise<string> {
        this.logger.log(
            `Generating test suite for ${missingTest.method} ${missingTest.endpoint}`,
        );

        if (reflectionImprovements) {
            this.logger.debug(
                `Using reflection improvements for test generation`,
            );
        }

        const prompt = this.buildTestGenerationPrompt(
            missingTest,
            endpointInfo,
            existingTestExamples,
            testPatterns,
            reflectionImprovements,
        );

        try {
            const response = await this.llm.invoke(prompt);
            let testCode = response.content as string;

            // Clean up the response - remove markdown code blocks if present
            testCode = this.cleanGeneratedCode(testCode);

            this.logger.log(
                `Generated test suite, length: ${testCode.length} characters`,
            );
            return testCode;
        } catch (error: any) {
            this.logger.error(
                `Error generating test suite: ${error.message}`,
                error.stack,
            );
            throw new Error(`Failed to generate test suite: ${error.message}`);
        }
    }

    private buildTestGenerationPrompt(
        missingTest: MissingTest,
        endpointInfo: EndpointInfo,
        existingTestExamples: string,
        testPatterns: string,
        reflectionImprovements?: string,
    ): string {
        const parametersInfo = endpointInfo.parameters
            ?.map((p: any) => `- ${p.name} (${p.in}): ${p.schema?.type || 'unknown'}`)
            .join('\n') || 'No parameters';

        const responsesInfo = Object.entries(endpointInfo.responses || {})
            .map(([status, response]: [string, any]) => {
                return `- ${status}: ${response.description || 'No description'}`;
            })
            .join('\n') || 'No response documentation';

        return `You are an expert test engineer. Generate a complete e2e test file for a NestJS API endpoint.

Endpoint Details:
- Path: ${missingTest.endpoint}
- Method: ${missingTest.method}
- Summary: ${endpointInfo.summary || 'No summary available'}
- Operation ID: ${endpointInfo.operationId || 'N/A'}
- Tags: ${endpointInfo.tags?.join(', ') || 'None'}

Parameters:
${parametersInfo}

Expected Responses:
${responsesInfo}

API Base URL: ${this.apiBaseUrl}

Existing Test Examples (for reference):
${existingTestExamples || 'No existing test examples available'}

Test Patterns and Conventions:
${testPatterns || 'No specific patterns available'}

${reflectionImprovements ? `Previous Attempt Improvements:\n${reflectionImprovements}\n\n` : ''}Requirements:
1. Use Jest and Supertest for testing
2. Import request from 'supertest' (default import)
3. Use the API_BASE_URL environment variable or default to 'http://localhost:3001'
4. Follow the existing test structure and naming conventions
5. Include comprehensive test cases:
   - Happy path scenarios
   - Error cases (404, 400, etc.)
   - Edge cases
   - Response validation
6. Use descriptive test names
7. Include proper assertions
8. Handle async operations correctly
9. The test file should be complete and ready to run

Generate ONLY the test code, no explanations or markdown formatting. Start directly with the import statements.

Test Code:`;
    }

    private cleanGeneratedCode(code: string): string {
        // Remove markdown code blocks
        code = code.replace(/^```typescript\n?/gm, '');
        code = code.replace(/^```ts\n?/gm, '');
        code = code.replace(/^```\n?/gm, '');
        code = code.replace(/```$/gm, '');
        code = code.trim();

        // Ensure it starts with import
        if (!code.startsWith('import')) {
            const importMatch = code.match(/import[\s\S]*?;/);
            if (importMatch) {
                const importIndex = code.indexOf(importMatch[0]);
                code = code.substring(importIndex);
            }
        }

        return code;
    }

    generateTestFileName(endpoint: string): string {
        // Convert endpoint path to filename
        // e.g., /users -> users.e2e-spec.ts
        // e.g., /users/{id} -> users-id.e2e-spec.ts
        let fileName = endpoint
            .replace(/^\//, '') // Remove leading slash
            .replace(/\//g, '-') // Replace slashes with dashes
            .replace(/{([^}]+)}/g, '$1') // Replace {id} with id
            .replace(/[^a-z0-9-]/gi, '-') // Replace special chars with dashes
            .toLowerCase();

        if (!fileName) {
            fileName = 'endpoint';
        }

        return `${fileName}.e2e-spec.ts`;
    }
}

