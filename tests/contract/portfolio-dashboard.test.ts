/**
 * Portfolio Dashboard Contract Tests
 * 
 * Validates that backend API endpoints exist and return expected schemas
 * These tests verify the API contracts without requiring implementation details
 */

import { describe, it, expect } from 'vitest';
import type {
  PortfolioSummary,
  ChartDataPoint,
  Account,
  ActionResult,
} from '@/features/portfolio-dashboard/types/portfolio-dashboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

describe('Portfolio Dashboard API Contracts', () => {
  // Note: These tests require a running backend API
  // They are contract tests that validate request/response schemas

  describe('GET /api/portfolios/summary', () => {
    it('should return portfolio summary with required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/portfolios/summary`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Contract: Endpoint must return 200 OK
      expect(response.status).toBe(200);

      const data: PortfolioSummary = await response.json();

      // Contract: Response must have required fields
      expect(data).toHaveProperty('totalValue');
      expect(data).toHaveProperty('dailyGainLoss');
      expect(data).toHaveProperty('dailyGainLossPercent');
      expect(data).toHaveProperty('lastUpdated');

      // Contract: Fields must have correct types
      expect(typeof data.totalValue).toBe('number');
      expect(typeof data.dailyGainLoss).toBe('number');
      expect(typeof data.dailyGainLossPercent).toBe('number');
      expect(typeof data.lastUpdated).toBe('string');

      // Contract: Values must be reasonable
      expect(data.totalValue).toBeGreaterThanOrEqual(0);
      expect(data.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    });
  });

  describe('GET /api/portfolios/history', () => {
    it.each(['30', '60', '90', '180', 'ttm'])(
      'should return chart data for period %s',
      async (period) => {
        const response = await fetch(
          `${API_BASE_URL}/portfolios/history?period=${period}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        // Contract: Endpoint must return 200 OK
        expect(response.status).toBe(200);

        const data: ChartDataPoint[] = await response.json();

        // Contract: Response must be an array
        expect(Array.isArray(data)).toBe(true);

        // Contract: Each data point must have required fields
        if (data.length > 0) {
          const point = data[0];
          expect(point).toHaveProperty('date');
          expect(point).toHaveProperty('value');

          // Contract: Fields must have correct types
          expect(typeof point.date).toBe('string');
          expect(typeof point.value).toBe('number');

          // Contract: Date must be ISO format
          expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
        }
      }
    );
  });

  describe('GET /api/accounts', () => {
    it('should return array of accounts with all required fields', async () => {
      const response = await fetch(`${API_BASE_URL}/accounts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Contract: Endpoint must return 200 OK
      expect(response.status).toBe(200);

      const data: Account[] = await response.json();

      // Contract: Response must be an array
      expect(Array.isArray(data)).toBe(true);

      // Contract: Each account must have required fields
      if (data.length > 0) {
        const account = data[0];
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('name');
        expect(account).toHaveProperty('currentValue');
        expect(account).toHaveProperty('todayGainLoss');
        expect(account).toHaveProperty('todayGainLossPercent');
        expect(account).toHaveProperty('excessCash');
        expect(account).toHaveProperty('correctableDrift');
        expect(account).toHaveProperty('totalDrift');
        expect(account).toHaveProperty('positionCount');
        expect(account).toHaveProperty('cashBalance');

        // Contract: Fields must have correct types
        expect(typeof account.id).toBe('string');
        expect(typeof account.name).toBe('string');
        expect(typeof account.currentValue).toBe('number');
        expect(typeof account.todayGainLoss).toBe('number');
        expect(typeof account.todayGainLossPercent).toBe('number');
        expect(typeof account.excessCash).toBe('number');
        expect(typeof account.correctableDrift).toBe('number');
        expect(typeof account.totalDrift).toBe('number');
        expect(typeof account.positionCount).toBe('number');
        expect(typeof account.cashBalance).toBe('number');

        // Contract: IDs should be non-empty
        expect(account.id.length).toBeGreaterThan(0);
        expect(account.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('POST /api/accounts/liquidate', () => {
    it('should accept array of account IDs and return action result', async () => {
      const testAccountIds = ['account-1', 'account-2'];

      const response = await fetch(`${API_BASE_URL}/accounts/liquidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: testAccountIds }),
      });

      // Contract: Endpoint must return 200 OK or 400 Bad Request (validation)
      expect([200, 400, 401]).toContain(response.status);

      if (response.status === 200) {
        const data: ActionResult = await response.json();

        // Contract: Response must have required fields
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('successCount');
        expect(data).toHaveProperty('failureCount');
        expect(data).toHaveProperty('errors');
        expect(data).toHaveProperty('message');

        // Contract: Fields must have correct types
        expect(typeof data.success).toBe('boolean');
        expect(typeof data.successCount).toBe('number');
        expect(typeof data.failureCount).toBe('number');
        expect(Array.isArray(data.errors)).toBe(true);
        expect(typeof data.message).toBe('string');

        // Contract: Counts must be non-negative
        expect(data.successCount).toBeGreaterThanOrEqual(0);
        expect(data.failureCount).toBeGreaterThanOrEqual(0);

        // Contract: Error array must have correct structure
        data.errors.forEach((error) => {
          expect(error).toHaveProperty('accountId');
          expect(error).toHaveProperty('reason');
          expect(typeof error.accountId).toBe('string');
          expect(typeof error.reason).toBe('string');
        });
      }
    });
  });

  describe('POST /api/accounts/rebalance', () => {
    it('should accept array of account IDs and return action result', async () => {
      const testAccountIds = ['account-1', 'account-2'];

      const response = await fetch(`${API_BASE_URL}/accounts/rebalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: testAccountIds }),
      });

      // Contract: Endpoint must return 200 OK or 400/401
      expect([200, 400, 401]).toContain(response.status);

      if (response.status === 200) {
        const data: ActionResult = await response.json();

        // Contract: Response must have required fields
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('successCount');
        expect(data).toHaveProperty('failureCount');
        expect(data).toHaveProperty('errors');
        expect(data).toHaveProperty('message');
      }
    });
  });

  describe('POST /api/accounts/use-cash', () => {
    it('should accept array of account IDs and return action result', async () => {
      const testAccountIds = ['account-1', 'account-2'];

      const response = await fetch(`${API_BASE_URL}/accounts/use-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: testAccountIds }),
      });

      // Contract: Endpoint must return 200 OK or 400/401
      expect([200, 400, 401]).toContain(response.status);

      if (response.status === 200) {
        const data: ActionResult = await response.json();

        // Contract: Response must have required fields
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('successCount');
        expect(data).toHaveProperty('failureCount');
        expect(data).toHaveProperty('errors');
        expect(data).toHaveProperty('message');
      }
    });
  });

  describe('GET /api/market-hours', () => {
    it('should return market open status', async () => {
      const response = await fetch(`${API_BASE_URL}/market-hours`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Contract: Endpoint must return 200 OK
      expect(response.status).toBe(200);

      const data = await response.json();

      // Contract: Response must have isOpen field
      expect(data).toHaveProperty('isOpen');
      expect(typeof data.isOpen).toBe('boolean');
    });
  });
});
