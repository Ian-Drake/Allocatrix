import { describe, it, expect } from 'vitest';
import { transformChartData } from '@/features/portfolio-dashboard/utils/chart-data-transform';
import type { Timeframe } from '@/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('transformChartData utility', () => {
  const mockRawData = [
    { date: '2024-01-01', value: 100000 },
    { date: '2024-01-02', value: 102000 },
    { date: '2024-01-03', value: 101500 },
    { date: '2024-01-04', value: 103000 },
    { date: '2024-01-05', value: 104000 },
  ];

  it('should transform raw data to chart format', () => {
    const result = transformChartData(mockRawData, '30d' as Timeframe);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(mockRawData.length);
  });

  it('should maintain date property in transformed data', () => {
    const result = transformChartData(mockRawData, '30d' as Timeframe);
    expect(result[0]).toHaveProperty('date');
    expect(result[0].date).toBe('2024-01-01');
  });

  it('should maintain value property in transformed data', () => {
    const result = transformChartData(mockRawData, '30d' as Timeframe);
    expect(result[0]).toHaveProperty('value');
    expect(result[0].value).toBe(100000);
  });

  it('should handle empty data array', () => {
    const result = transformChartData([], '30d' as Timeframe);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should handle different timeframes', () => {
    const result30d = transformChartData(mockRawData, '30d' as Timeframe);
    const result60d = transformChartData(mockRawData, '60d' as Timeframe);
    const result90d = transformChartData(mockRawData, '90d' as Timeframe);
    const result180d = transformChartData(mockRawData, '180d' as Timeframe);
    const resultTtm = transformChartData(mockRawData, 'ttm' as Timeframe);

    expect(result30d).toBeDefined();
    expect(result60d).toBeDefined();
    expect(result90d).toBeDefined();
    expect(result180d).toBeDefined();
    expect(resultTtm).toBeDefined();
  });

  it('should handle single data point', () => {
    const singleData = [{ date: '2024-01-01', value: 100000 }];
    const result = transformChartData(singleData, '30d' as Timeframe);
    expect(result.length).toBe(1);
    expect(result[0].value).toBe(100000);
  });

  it('should preserve data order', () => {
    const result = transformChartData(mockRawData, '30d' as Timeframe);
    expect(result[0].value).toBe(100000);
    expect(result[1].value).toBe(102000);
    expect(result[2].value).toBe(101500);
    expect(result[3].value).toBe(103000);
    expect(result[4].value).toBe(104000);
  });

  it('should handle data with null/undefined values gracefully', () => {
    const dataWithNulls = [
      { date: '2024-01-01', value: 100000 },
      { date: '2024-01-02', value: 102000 },
      { date: '2024-01-03', value: 101500 },
    ];
    expect(() => {
      transformChartData(dataWithNulls, '30d' as Timeframe);
    }).not.toThrow();
  });
});
