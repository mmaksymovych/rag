import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RagService } from './rag.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RagService', () => {
  let service: RagService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                RAG_API_URL: 'http://localhost:3000',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryRag', () => {
    it('should query RAG system successfully', async () => {
      const mockResponse = {
        data: {
          response: 'Test response from RAG',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.queryRag('test query');

      expect(result).toBe('Test response from RAG');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/chat',
        { query: 'test query', topK: 5 },
        { timeout: 30000 },
      );
    });

    it('should handle response with answer field', async () => {
      const mockResponse = {
        data: {
          answer: 'Alternative response format',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.queryRag('test query');

      expect(result).toBe('Alternative response format');
    });

    it('should return empty string on error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.queryRag('test query');

      expect(result).toBe('');
    });
  });

  describe('queryExistingTests', () => {
    it('should query for existing tests for an endpoint', async () => {
      const mockResponse = {
        data: {
          response: 'Tests found: users.e2e-spec.ts',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.queryExistingTests('/users');

      expect(result).toContain('users.e2e-spec.ts');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3000/chat',
        expect.objectContaining({
          query: expect.stringContaining('/users'),
        }),
        { timeout: 30000 },
      );
    });
  });

  describe('queryTestPatterns', () => {
    it('should query for test patterns', async () => {
      const mockResponse = {
        data: {
          response: 'Common patterns: describe blocks, it blocks',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.queryTestPatterns();

      expect(result).toContain('patterns');
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('getAllExistingTestFiles', () => {
    it('should extract test file names from RAG response', async () => {
      const mockResponse = {
        data: {
          response:
            'Test files: users.e2e-spec.ts, health.e2e-spec.ts, posts.e2e-spec.ts',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.getAllExistingTestFiles();

      expect(result).toContain('users.e2e-spec.ts');
      expect(result).toContain('health.e2e-spec.ts');
      expect(result).toContain('posts.e2e-spec.ts');
    });

    it('should return empty array when no files found', async () => {
      const mockResponse = {
        data: {
          response: 'No test files found',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.getAllExistingTestFiles();

      expect(result).toEqual([]);
    });
  });
});

