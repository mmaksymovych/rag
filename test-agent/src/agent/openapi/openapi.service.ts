import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface EndpointInfo {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: any[];
  responses?: any;
}

@Injectable()
export class OpenApiService {
  private readonly logger = new Logger(OpenApiService.name);
  private readonly openApiUrl: string;
  private readonly openApiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.openApiUrl =
      this.configService.get<string>('OPENAPI_SPEC_URL') ||
      'http://localhost:3001/api-docs-json';
    this.openApiBaseUrl =
      this.configService.get<string>('OPENAPI_PROJECT_URL') ||
      'http://localhost:3001';
  }

  async fetchOpenApiSpec(): Promise<any> {
    try {
      this.logger.log(`Fetching OpenAPI spec from ${this.openApiUrl}`);
      const response = await axios.get(this.openApiUrl, {
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch OpenAPI spec: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch OpenAPI spec: ${error.message}`);
    }
  }

  async verifyServerRunning(): Promise<boolean> {
    try {
      const healthUrl = `${this.openApiBaseUrl}/health`;
      this.logger.log(`Verifying server health at ${healthUrl}`);
      const response = await axios.get(healthUrl, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error: any) {
      this.logger.warn(`Server health check failed: ${error.message}`);
      return false;
    }
  }

  async getEndpoints(): Promise<EndpointInfo[]> {
    this.logger.debug('Parsing endpoints from OpenAPI spec');
    const spec = await this.fetchOpenApiSpec();
    const endpoints: EndpointInfo[] = [];

    if (!spec.paths) {
      this.logger.warn('No paths found in OpenAPI spec');
      return endpoints;
    }

    this.logger.debug(`Processing ${Object.keys(spec.paths).length} paths from OpenAPI spec`);

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem !== 'object' || pathItem === null) {
        this.logger.debug(`Skipping invalid path item: ${path}`);
        continue;
      }

      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method];
          const endpoint: EndpointInfo = {
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            tags: operation.tags || [],
            parameters: operation.parameters || [],
            responses: operation.responses || {},
          };

          endpoints.push(endpoint);
          this.logger.debug(
            `Parsed endpoint: ${endpoint.method} ${endpoint.path} (${endpoint.operationId || 'no operationId'})`,
          );
        }
      }
    }

    this.logger.log(`Found ${endpoints.length} endpoints in OpenAPI spec`);
    this.logger.debug(
      `Endpoint breakdown: ${endpoints.map((e) => `${e.method} ${e.path}`).join(', ')}`,
    );
    return endpoints;
  }

  async getEndpointByPathAndMethod(
    path: string,
    method: string,
  ): Promise<EndpointInfo | null> {
    const endpoints = await this.getEndpoints();
    return (
      endpoints.find(
        (ep) => ep.path === path && ep.method === method.toUpperCase(),
      ) || null
    );
  }
}

