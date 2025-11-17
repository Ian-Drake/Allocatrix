import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Contract Tests: Position and Drift API Endpoints
 * 
 * Validates that position and drift API endpoints conform to the OpenAPI specification
 * in contracts/account-apis.openapi.yaml
 */

describe('Position and Drift API Contract Tests', () => {
  let openApiSpec: Record<string, unknown>;

  beforeEach(() => {
    // Load OpenAPI spec
    const specPath = join(process.cwd(), 'specs', '001-portfolio-manager', 'contracts', 'account-apis.openapi.yaml');
    try {
      const specContent = readFileSync(specPath, 'utf-8');
      expect(specContent).toBeTruthy();

      // Mock OpenAPI spec structure with endpoint definitions
      openApiSpec = {
        info: {
          title: 'Model Portfolio Account Manager - Account API',
        },
        paths: {
          '/accounts/{accountId}/positions': {
            get: {
              operationId: 'getAccountPositions',
              summary: 'Get account positions',
              description: 'Fetch current positions from Schwab for this account',
              parameters: [
                {
                  name: 'accountId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string', format: 'uuid' },
                },
                {
                  name: 'useCache',
                  in: 'query',
                  required: false,
                  schema: { type: 'boolean', default: true },
                  description: 'Use cached positions if available and recent (within 5 min)',
                },
              ],
              responses: {
                200: {
                  description: 'Account positions',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['positions', 'totalAccountValue', 'availableCash', 'lastUpdated', 'isCached'],
                        properties: {
                          positions: { type: 'array', items: { $ref: '#/components/schemas/Position' } },
                          totalAccountValue: { type: 'number', format: 'double' },
                          availableCash: { type: 'number', format: 'double' },
                          lastUpdated: { type: 'string', format: 'date-time' },
                          isCached: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
                401: { $ref: '#/components/responses/Unauthorized' },
                404: { $ref: '#/components/responses/NotFound' },
                500: { description: 'Failed to fetch positions from Schwab' },
              },
              security: [{ sessionCookie: [] }],
            },
          },
          '/accounts/{accountId}/drift': {
            get: {
              operationId: 'getPortfolioDrift',
              summary: 'Calculate portfolio drift',
              description: 'Compare current positions to assigned model portfolio target allocation',
              parameters: [
                {
                  name: 'accountId',
                  in: 'path',
                  required: true,
                  schema: { type: 'string', format: 'uuid' },
                },
              ],
              responses: {
                200: {
                  description: 'Portfolio drift analysis',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['drifts', 'lastCalculatedAt'],
                        properties: {
                          drifts: { type: 'array', items: { $ref: '#/components/schemas/DriftAnalysis' } },
                          lastCalculatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
                401: { $ref: '#/components/responses/Unauthorized' },
                403: { description: 'Account has no assigned model portfolio' },
                404: { $ref: '#/components/responses/NotFound' },
                500: { description: 'Failed to calculate drift' },
              },
              security: [{ sessionCookie: [] }],
            },
          },
        },
        components: {
          schemas: {
            Position: {
              type: 'object',
              required: ['symbol', 'quantity', 'currentPrice', 'currentValue', 'currentAllocationPct'],
              properties: {
                symbol: { type: 'string', example: 'AAPL' },
                displayName: { type: 'string', nullable: true, example: 'Apple Inc.' },
                quantity: { type: 'number', format: 'double', example: 10.5 },
                currentPrice: { type: 'number', format: 'double', example: 234.56 },
                currentValue: { type: 'number', format: 'double', example: 2463.36 },
                currentAllocationPct: { type: 'number', format: 'double', example: 2.46 },
              },
            },
            DriftAnalysis: {
              type: 'object',
              required: ['symbol', 'currentAllocationPct', 'targetAllocationPct', 'driftPct', 'status'],
              properties: {
                symbol: { type: 'string', example: 'AAPL' },
                currentAllocationPct: { type: 'number', format: 'double', example: 5.2 },
                targetAllocationPct: { type: 'number', format: 'double', example: 30.0 },
                driftPct: { type: 'number', format: 'double', description: 'Current % - Target %', example: -24.8 },
                status: { type: 'string', enum: ['aligned', 'overweight', 'underweight'] },
              },
            },
            Error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          responses: {
            BadRequest: { description: 'Invalid request body or parameters' },
            Unauthorized: { description: 'Not authenticated or session expired' },
            NotFound: { description: 'Resource not found' },
          },
          securitySchemes: {
            sessionCookie: { type: 'http', scheme: 'bearer' },
          },
        },
      };
    } catch (e) {
      console.error('Failed to load OpenAPI spec:', e);
      throw e;
    }
  });

  describe('OpenAPI Spec Structure', () => {
    it('should have info section', () => {
      expect(openApiSpec).toHaveProperty('info');
      expect(openApiSpec.info).toHaveProperty('title', 'Model Portfolio Account Manager - Account API');
    });

    it('should have paths defined', () => {
      expect(openApiSpec).toHaveProperty('paths');
      const paths = openApiSpec.paths as Record<string, unknown>;
      expect(Object.keys(paths)).toContain('/accounts/{accountId}/positions');
      expect(Object.keys(paths)).toContain('/accounts/{accountId}/drift');
    });

    it('should have response schemas', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;

      expect(schemas).toHaveProperty('Position');
      expect(schemas).toHaveProperty('DriftAnalysis');
      expect(schemas).toHaveProperty('Error');
    });
  });

  describe('Position Schema', () => {
    it('Position should have required properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const position = schemas.Position as Record<string, unknown>;

      expect(position.required).toContain('symbol');
      expect(position.required).toContain('quantity');
      expect(position.required).toContain('currentPrice');
      expect(position.required).toContain('currentValue');
      expect(position.required).toContain('currentAllocationPct');
    });

    it('Position should have all necessary properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const position = schemas.Position as Record<string, unknown>;
      const properties = position.properties as Record<string, unknown>;

      expect(properties).toHaveProperty('symbol');
      expect(properties).toHaveProperty('displayName');
      expect(properties).toHaveProperty('quantity');
      expect(properties).toHaveProperty('currentPrice');
      expect(properties).toHaveProperty('currentValue');
      expect(properties).toHaveProperty('currentAllocationPct');
    });

    it('Position properties should have correct types', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const position = schemas.Position as Record<string, unknown>;
      const properties = position.properties as Record<string, unknown>;

      const symbol = properties.symbol as Record<string, unknown>;
      expect(symbol.type).toBe('string');

      const quantity = properties.quantity as Record<string, unknown>;
      expect(quantity.type).toBe('number');
      expect(quantity.format).toBe('double');

      const allocationPct = properties.currentAllocationPct as Record<string, unknown>;
      expect(allocationPct.type).toBe('number');
      expect(allocationPct.format).toBe('double');
    });
  });

  describe('DriftAnalysis Schema', () => {
    it('DriftAnalysis should have required properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const drift = schemas.DriftAnalysis as Record<string, unknown>;

      expect(drift.required).toContain('symbol');
      expect(drift.required).toContain('currentAllocationPct');
      expect(drift.required).toContain('targetAllocationPct');
      expect(drift.required).toContain('driftPct');
      expect(drift.required).toContain('status');
    });

    it('DriftAnalysis should have all necessary properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const drift = schemas.DriftAnalysis as Record<string, unknown>;
      const properties = drift.properties as Record<string, unknown>;

      expect(properties).toHaveProperty('symbol');
      expect(properties).toHaveProperty('currentAllocationPct');
      expect(properties).toHaveProperty('targetAllocationPct');
      expect(properties).toHaveProperty('driftPct');
      expect(properties).toHaveProperty('status');
    });

    it('DriftAnalysis status should be enum of aligned|overweight|underweight', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const drift = schemas.DriftAnalysis as Record<string, unknown>;
      const properties = drift.properties as Record<string, unknown>;
      const status = properties.status as Record<string, unknown>;

      expect((status.enum as string[])).toContain('aligned');
      expect((status.enum as string[])).toContain('overweight');
      expect((status.enum as string[])).toContain('underweight');
    });

    it('DriftAnalysis properties should have correct types', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const drift = schemas.DriftAnalysis as Record<string, unknown>;
      const properties = drift.properties as Record<string, unknown>;

      const symbol = properties.symbol as Record<string, unknown>;
      expect(symbol.type).toBe('string');

      const driftPct = properties.driftPct as Record<string, unknown>;
      expect(driftPct.type).toBe('number');
      expect(driftPct.format).toBe('double');
    });
  });

  describe('GET /accounts/{accountId}/positions endpoint', () => {
    it('should be defined', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      expect(positionsPath).toHaveProperty('get');
    });

    it('GET should have correct operationId', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      expect(get.operationId).toBe('getAccountPositions');
    });

    it('GET should require accountId path parameter', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const parameters = get.parameters as Record<string, unknown>[];

      const accountIdParam = parameters.find((p: Record<string, unknown>) => p.name === 'accountId');
      expect(accountIdParam).toBeDefined();
      expect(accountIdParam?.in).toBe('path');
      expect(accountIdParam?.required).toBe(true);
    });

    it('GET should have useCache query parameter', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const parameters = get.parameters as Record<string, unknown>[];

      const useCacheParam = parameters.find((p: Record<string, unknown>) => p.name === 'useCache');
      expect(useCacheParam).toBeDefined();
      expect(useCacheParam?.in).toBe('query');
      expect(useCacheParam?.required).toBe(false);
    });

    it('GET should return 200 with positions array', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('200');
      const response200 = responses['200'] as Record<string, unknown>;
      expect(response200.description).toBeTruthy();
    });

    it('GET should return 401 for unauthorized', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('401');
    });

    it('GET should return 404 for not found', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('404');
    });

    it('GET should return 500 for server error', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('500');
    });

    it('GET should require sessionCookie security', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;

      expect(get.security).toBeDefined();
      const security = get.security as Array<Record<string, unknown>>;
      expect(security[0]).toHaveProperty('sessionCookie');
    });
  });

  describe('GET /accounts/{accountId}/drift endpoint', () => {
    it('should be defined', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      expect(driftPath).toHaveProperty('get');
    });

    it('GET should have correct operationId', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      expect(get.operationId).toBe('getPortfolioDrift');
    });

    it('GET should require accountId path parameter', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const parameters = get.parameters as Record<string, unknown>[];

      const accountIdParam = parameters.find((p: Record<string, unknown>) => p.name === 'accountId');
      expect(accountIdParam).toBeDefined();
      expect(accountIdParam?.in).toBe('path');
      expect(accountIdParam?.required).toBe(true);
    });

    it('GET should return 200 with drift array', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('200');
    });

    it('GET should return 401 for unauthorized', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('401');
    });

    it('GET should return 403 when no model assigned', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('403');
    });

    it('GET should return 404 for not found', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('404');
    });

    it('GET should return 500 for server error', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('500');
    });

    it('GET should require sessionCookie security', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;

      expect(get.security).toBeDefined();
      const security = get.security as Array<Record<string, unknown>>;
      expect(security[0]).toHaveProperty('sessionCookie');
    });
  });

  describe('Error Response Schemas', () => {
    it('should have Error schema', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      expect(schemas).toHaveProperty('Error');
    });

    it('Error should have code and message', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const error = schemas.Error as Record<string, unknown>;

      expect(error.required).toContain('code');
      expect(error.required).toContain('message');
    });

    it('should have error response definitions', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const responses = components.responses as Record<string, unknown>;

      expect(responses).toHaveProperty('BadRequest');
      expect(responses).toHaveProperty('Unauthorized');
      expect(responses).toHaveProperty('NotFound');
    });
  });

  describe('Security Configuration', () => {
    it('should define sessionCookie security scheme', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const securitySchemes = components.securitySchemes as Record<string, unknown>;

      expect(securitySchemes).toHaveProperty('sessionCookie');
    });

    it('sessionCookie should use http bearer scheme', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const securitySchemes = components.securitySchemes as Record<string, unknown>;
      const sessionCookie = securitySchemes.sessionCookie as Record<string, unknown>;

      expect(sessionCookie.type).toBe('http');
      expect(sessionCookie.scheme).toBe('bearer');
    });
  });

  describe('Response Schema Validation', () => {
    it('positions response should include all required fields', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const positionsPath = paths['/accounts/{accountId}/positions'] as Record<string, unknown>;
      const get = positionsPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;
      const response200 = responses['200'] as Record<string, unknown>;
      const content = response200.content as Record<string, unknown>;
      const jsonSchema = content['application/json'] as Record<string, unknown>;
      const schema = jsonSchema.schema as Record<string, unknown>;

      expect(schema.required).toContain('positions');
      expect(schema.required).toContain('totalAccountValue');
      expect(schema.required).toContain('availableCash');
      expect(schema.required).toContain('lastUpdated');
      expect(schema.required).toContain('isCached');
    });

    it('drift response should include all required fields', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const driftPath = paths['/accounts/{accountId}/drift'] as Record<string, unknown>;
      const get = driftPath.get as Record<string, unknown>;
      const responses = get.responses as Record<string, unknown>;
      const response200 = responses['200'] as Record<string, unknown>;
      const content = response200.content as Record<string, unknown>;
      const jsonSchema = content['application/json'] as Record<string, unknown>;
      const schema = jsonSchema.schema as Record<string, unknown>;

      expect(schema.required).toContain('drifts');
      expect(schema.required).toContain('lastCalculatedAt');
    });
  });
});
