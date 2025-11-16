import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenApiService } from './openapi.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenApiService', () => {
  let service: OpenApiService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenApiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                OPENAPI_SPEC_URL: 'http://localhost:3001/api-docs-json',
                OPENAPI_PROJECT_URL: 'http://localhost:3001',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OpenApiService>(OpenApiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchOpenApiSpec', () => {
    it('should fetch OpenAPI spec successfully', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        paths: {
          '/users': {
            get: {
              operationId: 'UsersController_findAll',
              summary: 'Get all users',
            },
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSpec });

      const result = await service.fetchOpenApiSpec();

      expect(result).toEqual(mockSpec);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api-docs-json',
        { timeout: 10000 },
      );
    });

    it('should throw error on fetch failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchOpenApiSpec()).rejects.toThrow(
        'Failed to fetch OpenAPI spec',
      );
    });
  });

  describe('verifyServerRunning', () => {
    it('should return true when server is running', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const result = await service.verifyServerRunning();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/health',
        { timeout: 5000 },
      );
    });

    it('should return false when server is not running', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.verifyServerRunning();

      expect(result).toBe(false);
    });
  });

  describe('getEndpoints', () => {
    it('should parse endpoints from OpenAPI spec', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        paths: {
          '/users': {
            get: {
              operationId: 'UsersController_findAll',
              summary: 'Get all users',
              tags: ['users'],
            },
            post: {
              operationId: 'UsersController_create',
              summary: 'Create user',
              tags: ['users'],
            },
          },
          '/health': {
            get: {
              operationId: 'AppController_getHealth',
              summary: 'Health check',
            },
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSpec });

      const endpoints = await service.getEndpoints();

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0]).toMatchObject({
        path: '/users',
        method: 'GET',
        operationId: 'UsersController_findAll',
        summary: 'Get all users',
        tags: ['users'],
      });
    });

    it('should return empty array when no paths found', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        paths: {},
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSpec });

      const endpoints = await service.getEndpoints();

      expect(endpoints).toEqual([]);
    });
  });

  describe('getEndpointByPathAndMethod', () => {
    it('should find endpoint by path and method', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        paths: {
          '/users': {
            get: {
              operationId: 'UsersController_findAll',
              summary: 'Get all users',
            },
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSpec });

      const endpoint = await service.getEndpointByPathAndMethod('/users', 'GET');

      expect(endpoint).not.toBeNull();
      expect(endpoint?.path).toBe('/users');
      expect(endpoint?.method).toBe('GET');
    });

    it('should return null when endpoint not found', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        paths: {
          '/users': {
            get: {
              operationId: 'UsersController_findAll',
            },
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSpec });

      const endpoint = await service.getEndpointByPathAndMethod('/posts', 'GET');

      expect(endpoint).toBeNull();
    });
  });
});

