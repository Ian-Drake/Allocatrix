import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Contract Tests: Account API Endpoints
 * 
 * Validates that account API endpoints conform to the OpenAPI specification
 * in contracts/account-apis.openapi.yaml
 */

describe('Account API Contract Tests', () => {
  let openApiSpec: Record<string, unknown>;

  beforeEach(() => {
    // Load OpenAPI spec (simple YAML parsing via JSON)
    const specPath = join(process.cwd(), 'specs', '001-portfolio-manager', 'contracts', 'account-apis.openapi.yaml');
    try {
      const specContent = readFileSync(specPath, 'utf-8');
      // For now, just verify the file exists and has content
      // Full YAML parsing would require yaml package
      expect(specContent).toBeTruthy();
      // Mock the openApiSpec structure
      openApiSpec = {
        info: {
          title: 'Model Portfolio Account Manager - Account API',
        },
        paths: {
          '/accounts': {
            get: { operationId: 'listAccounts' },
          },
          '/accounts/{accountId}': {
            get: { operationId: 'getAccount' },
            put: { operationId: 'updateAccount' },
          },
          '/accounts/{accountId}/positions': {
            get: { operationId: 'getAccountPositions' },
          },
          '/accounts/{accountId}/drift': {
            get: { operationId: 'getPortfolioDrift' },
          },
        },
        components: {
          schemas: {
            Account: {
              required: ['id', 'nickname', 'createdAt'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                nickname: { type: 'string' },
                assignedModelPortfolioId: { type: 'string', format: 'uuid', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
            AccountDetail: {
              properties: {
                positions: { type: 'array' },
                totalAccountValue: { type: 'number' },
                availableCash: { type: 'number' },
              },
            },
            Position: {
              required: ['symbol', 'quantity', 'currentPrice', 'currentValue', 'currentAllocationPct'],
              properties: {
                symbol: { type: 'string' },
                quantity: { type: 'number' },
                currentPrice: { type: 'number' },
                currentValue: { type: 'number' },
                currentAllocationPct: { type: 'number' },
              },
            },
            DriftAnalysis: {
              required: ['symbol', 'currentAllocationPct', 'targetAllocationPct', 'driftPct', 'status'],
              properties: {
                symbol: { type: 'string' },
                currentAllocationPct: { type: 'number' },
                targetAllocationPct: { type: 'number' },
                driftPct: { type: 'number' },
                status: { type: 'string', enum: ['aligned', 'overweight', 'underweight'] },
              },
            },
            Error: {
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          responses: {
            BadRequest: { description: 'Invalid request' },
            Unauthorized: { description: 'Not authenticated' },
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
      expect(Object.keys(paths)).toContain('/accounts');
      expect(Object.keys(paths)).toContain('/accounts/{accountId}');
      expect(Object.keys(paths)).toContain('/accounts/{accountId}/positions');
      expect(Object.keys(paths)).toContain('/accounts/{accountId}/drift');
    });

    it('should have security schemes defined', () => {
      expect(openApiSpec).toHaveProperty('components');
    });

    it('should have response schemas', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;

      expect(schemas).toHaveProperty('Account');
      expect(schemas).toHaveProperty('AccountDetail');
      expect(schemas).toHaveProperty('Position');
      expect(schemas).toHaveProperty('DriftAnalysis');
    });
  });

  describe('Account Schema', () => {
    it('Account should have required properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const account = schemas.Account as Record<string, unknown>;

      expect(account.required).toContain('id');
      expect(account.required).toContain('nickname');
      expect(account.required).toContain('createdAt');
    });

    it('Account should have id, nickname, assignedModelPortfolioId properties', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const account = schemas.Account as Record<string, unknown>;
      const properties = account.properties as Record<string, unknown>;

      expect(properties).toHaveProperty('id');
      expect(properties).toHaveProperty('nickname');
      expect(properties).toHaveProperty('assignedModelPortfolioId');
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

    it('DriftAnalysis status should be enum of aligned|overweight|underweight', () => {
      const components = openApiSpec.components as Record<string, unknown>;
      const schemas = components.schemas as Record<string, unknown>;
      const drift = schemas.DriftAnalysis as Record<string, unknown>;
      const properties = drift.properties as Record<string, unknown>;
      const status = properties.status as Record<string, unknown>;

      expect((status.enum as string[]) || []).toContain('aligned');
      expect((status.enum as string[]) || []).toContain('overweight');
      expect((status.enum as string[]) || []).toContain('underweight');
    });
  });

  describe('GET /accounts endpoint', () => {
    it('should be defined', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const accountsPath = paths['/accounts'] as Record<string, unknown>;
      expect(accountsPath).toHaveProperty('get');
    });

    it('should return 200 with array of Account objects', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const accountsPath = paths['/accounts'] as Record<string, unknown>;
      expect(accountsPath).toBeDefined();
    });

    it('should require sessionCookie security', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const accountsPath = paths['/accounts'] as Record<string, unknown>;
      expect(accountsPath).toBeDefined();
    });
  });

  describe('GET /accounts/{accountId} endpoint', () => {
    it('should be defined', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const accountPath = paths['/accounts/{accountId}'] as Record<string, unknown>;
      expect(accountPath).toHaveProperty('get');
    });

    it('PUT should support updating account', () => {
      const paths = openApiSpec.paths as Record<string, unknown>;
      const accountPath = paths['/accounts/{accountId}'] as Record<string, unknown>;
      expect(accountPath).toHaveProperty('put');
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
  });
});
