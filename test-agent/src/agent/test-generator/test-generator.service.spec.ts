import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TestGeneratorService } from './test-generator.service';
import { ChatOpenAI } from '@langchain/openai';

jest.mock('@langchain/openai');

describe('TestGeneratorService', () => {
  let service: TestGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestGeneratorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
                OPENAPI_PROJECT_URL: 'http://localhost:3001',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TestGeneratorService>(TestGeneratorService);
  });

  describe('generateTestFileName', () => {
    it('should generate correct filename for simple endpoint', () => {
      const fileName = service.generateTestFileName('/users');
      expect(fileName).toBe('users.e2e-spec.ts');
    });

    it('should handle endpoint with path parameters', () => {
      const fileName = service.generateTestFileName('/users/{id}');
      expect(fileName).toBe('users-id.e2e-spec.ts');
    });

    it('should handle nested paths', () => {
      const fileName = service.generateTestFileName('/api/v1/users');
      expect(fileName).toBe('api-v1-users.e2e-spec.ts');
    });

    it('should handle empty endpoint', () => {
      const fileName = service.generateTestFileName('/');
      expect(fileName).toBe('endpoint.e2e-spec.ts');
    });
  });

  describe('generateTestSuite', () => {
    it('should generate test suite using LLM', async () => {
      const missingTest = {
        endpoint: '/users',
        method: 'GET',
        reason: 'No test exists',
      };

      const endpointInfo = {
        path: '/users',
        method: 'GET',
        summary: 'Get all users',
        operationId: 'UsersController_findAll',
        tags: ['users'],
        parameters: [],
        responses: {
          '200': { description: 'Success' },
        },
      };

      const mockTestCode = `import request from 'supertest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Users Endpoint (e2e)', () => {
  describe('GET /users', () => {
    it('should return an array of users', () => {
      return request(API_BASE_URL)
        .get('/users')
        .expect(200);
    });
  });
});`;

      const mockLLMResponse = {
        content: mockTestCode,
      };

      const mockInvoke = jest.fn().mockResolvedValue(mockLLMResponse);
      (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(
        () =>
          ({
            invoke: mockInvoke,
          }) as any,
      );

      // Recreate service to get new LLM instance
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestGeneratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                  LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
                  OPENAPI_PROJECT_URL: 'http://localhost:3001',
                };
                return config[key] || defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const newService = module.get<TestGeneratorService>(TestGeneratorService);

      const result = await newService.generateTestSuite(
        missingTest,
        endpointInfo,
        '',
        '',
      );

      expect(result).toContain('import request from');
      expect(result).toContain('GET /users');
      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should clean markdown code blocks from response', async () => {
      const missingTest = {
        endpoint: '/users',
        method: 'GET',
        reason: 'No test exists',
      };

      const endpointInfo = {
        path: '/users',
        method: 'GET',
        summary: 'Get all users',
      };

      const mockTestCodeWithMarkdown =
        "```typescript\nimport request from 'supertest';\n```";

      const mockLLMResponse = {
        content: mockTestCodeWithMarkdown,
      };

      const mockInvoke = jest.fn().mockResolvedValue(mockLLMResponse);
      (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(
        () =>
          ({
            invoke: mockInvoke,
          }) as any,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestGeneratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                  LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
                  OPENAPI_PROJECT_URL: 'http://localhost:3001',
                };
                return config[key] || defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const newService = module.get<TestGeneratorService>(TestGeneratorService);

      const result = await newService.generateTestSuite(
        missingTest,
        endpointInfo,
        '',
        '',
      );

      expect(result).not.toContain('```typescript');
      expect(result).not.toContain('```');
    });
  });
});
