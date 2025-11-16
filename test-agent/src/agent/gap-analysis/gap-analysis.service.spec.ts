import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GapAnalysisService } from './gap-analysis.service';
import { OpenApiService } from '../openapi/openapi.service';
import { RagService } from '../rag/rag.service';
import { ChatOpenAI } from '@langchain/openai';

jest.mock('@langchain/openai');

describe('GapAnalysisService', () => {
  let service: GapAnalysisService;
  let openApiService: OpenApiService;
  let ragService: RagService;

  const mockOpenApiService = {
    getEndpoints: jest.fn(),
    getEndpointByPathAndMethod: jest.fn(),
  };

  const mockRagService = {
    getAllExistingTestFiles: jest.fn(),
    queryTestPatterns: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GapAnalysisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: OpenApiService,
          useValue: mockOpenApiService,
        },
        {
          provide: RagService,
          useValue: mockRagService,
        },
      ],
    }).compile();

    service = module.get<GapAnalysisService>(GapAnalysisService);
    openApiService = module.get<OpenApiService>(OpenApiService);
    ragService = module.get<RagService>(RagService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findMissingTests', () => {
    it('should identify missing tests using LLM', async () => {
      const mockEndpoints = [
        {
          path: '/users',
          method: 'GET',
          summary: 'Get all users',
        },
        {
          path: '/posts',
          method: 'GET',
          summary: 'Get all posts',
        },
      ];

      const mockExistingTests = ['users.e2e-spec.ts'];
      const mockTestPatterns = 'Test patterns: describe blocks, it blocks';

      mockOpenApiService.getEndpoints.mockResolvedValue(mockEndpoints);
      mockRagService.getAllExistingTestFiles.mockResolvedValue(
        mockExistingTests,
      );
      mockRagService.queryTestPatterns.mockResolvedValue(mockTestPatterns);

      const mockLLMResponse = {
        content: JSON.stringify([
          {
            endpoint: '/posts',
            method: 'GET',
            reason: 'No test file found for posts endpoint',
          },
        ]),
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
          GapAnalysisService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                  LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
                };
                return config[key] || defaultValue;
              }),
            },
          },
          {
            provide: OpenApiService,
            useValue: mockOpenApiService,
          },
          {
            provide: RagService,
            useValue: mockRagService,
          },
        ],
      }).compile();

      const newService = module.get<GapAnalysisService>(GapAnalysisService);

      const result = await newService.findMissingTests();

      expect(result).toHaveLength(1);
      expect(result[0].endpoint).toBe('/posts');
      expect(mockOpenApiService.getEndpoints).toHaveBeenCalled();
      expect(mockRagService.getAllExistingTestFiles).toHaveBeenCalled();
    });

    it('should return fallback when LLM analysis fails', async () => {
      const mockEndpoints = [
        {
          path: '/users',
          method: 'GET',
          summary: 'Get all users',
        },
      ];

      mockOpenApiService.getEndpoints.mockResolvedValue(mockEndpoints);
      mockRagService.getAllExistingTestFiles.mockResolvedValue([]);
      mockRagService.queryTestPatterns.mockResolvedValue('');

      const mockInvoke = jest.fn().mockRejectedValue(new Error('LLM error'));
      (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(
        () =>
          ({
            invoke: mockInvoke,
          }) as any,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GapAnalysisService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                  LM_STUDIO_API_URL: 'http://127.0.0.1:1234/v1',
                  LM_STUDIO_MODEL: 'google/gemma-3n-e4b',
                };
                return config[key] || defaultValue;
              }),
            },
          },
          {
            provide: OpenApiService,
            useValue: mockOpenApiService,
          },
          {
            provide: RagService,
            useValue: mockRagService,
          },
        ],
      }).compile();

      const newService = module.get<GapAnalysisService>(GapAnalysisService);

      const result = await newService.findMissingTests();

      // Should return all endpoints as missing when LLM fails
      expect(result).toHaveLength(1);
      expect(result[0].endpoint).toBe('/users');
    });
  });

  describe('getEndpointDetails', () => {
    it('should get endpoint details', async () => {
      const mockEndpoint = {
        path: '/users',
        method: 'GET',
        summary: 'Get all users',
      };

      mockOpenApiService.getEndpointByPathAndMethod.mockResolvedValue(
        mockEndpoint,
      );

      const result = await service.getEndpointDetails('/users', 'GET');

      expect(result).toEqual(mockEndpoint);
      expect(
        mockOpenApiService.getEndpointByPathAndMethod,
      ).toHaveBeenCalledWith('/users', 'GET');
    });
  });
});
