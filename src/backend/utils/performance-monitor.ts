/**
 * Performance Monitor
 * 
 * Tracks API latencies against success criteria (SC-003 through SC-008).
 * Provides metrics for:
 * - SC-003: Position loading (<30s)
 * - SC-004: Position refresh (<3s)
 * - SC-005: Cash deployment calculation (<1s)
 * - SC-006: Rebalance calculation (<2s)
 * - SC-007: Trade execution (<5s)
 * - SC-008: 5-year backtest (<5s)
 * 
 * Usage:
 *   const timer = startTimer('position_load');
 *   // ... do work ...
 *   timer.end();
 */

import { logger } from './logger';

export type MetricName =
  | 'position_load' // SC-003: <30s
  | 'position_refresh' // SC-004: <3s
  | 'cash_deployment_calc' // SC-005: <1s
  | 'rebalance_calc' // SC-006: <2s
  | 'trade_execution' // SC-007: <5s
  | 'backtest_5yr' // SC-008: <5s
  | 'api_request'; // Generic API latency

interface PerformanceThresholds {
  warn: number; // ms - log warning if exceeded
  error: number; // ms - log error if exceeded
}

/**
 * Success criteria thresholds in milliseconds
 */
const THRESHOLDS: Record<MetricName, PerformanceThresholds> = {
  position_load: { warn: 25000, error: 30000 }, // SC-003: <30s
  position_refresh: { warn: 2500, error: 3000 }, // SC-004: <3s
  cash_deployment_calc: { warn: 800, error: 1000 }, // SC-005: <1s
  rebalance_calc: { warn: 1600, error: 2000 }, // SC-006: <2s
  trade_execution: { warn: 4000, error: 5000 }, // SC-007: <5s
  backtest_5yr: { warn: 4000, error: 5000 }, // SC-008: <5s
  api_request: { warn: 1000, error: 5000 }, // Generic: <5s
};

interface PerformanceMetric {
  name: MetricName;
  startTime: number;
  context?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  /**
   * Start timing a metric
   */
  start(name: MetricName, metricId?: string, context?: Record<string, unknown>): string {
    const id = metricId || `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.metrics.set(id, {
      name,
      startTime: Date.now(),
      context,
    });

    return id;
  }

  /**
   * End timing a metric and log results
   */
  end(metricId: string, additionalContext?: Record<string, unknown>): number | null {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      logger.warn('Performance metric not found', { metricId });
      return null;
    }

    const duration = Date.now() - metric.startTime;
    const threshold = THRESHOLDS[metric.name];

    const context = {
      ...metric.context,
      ...additionalContext,
      metric: metric.name,
      duration,
      threshold_warn: threshold.warn,
      threshold_error: threshold.error,
    };

    // Log based on threshold
    if (duration > threshold.error) {
      logger.error('Performance threshold exceeded (ERROR)', context);
    } else if (duration > threshold.warn) {
      logger.warn('Performance threshold exceeded (WARNING)', context);
    } else {
      logger.debug('Performance metric recorded', context);
    }

    // Clean up
    this.metrics.delete(metricId);

    return duration;
  }

  /**
   * Record a completed metric with known duration
   */
  record(name: MetricName, duration: number, context?: Record<string, unknown>): void {
    const threshold = THRESHOLDS[name];

    const logContext = {
      ...context,
      metric: name,
      duration,
      threshold_warn: threshold.warn,
      threshold_error: threshold.error,
    };

    if (duration > threshold.error) {
      logger.error('Performance threshold exceeded (ERROR)', logContext);
    } else if (duration > threshold.warn) {
      logger.warn('Performance threshold exceeded (WARNING)', logContext);
    } else {
      logger.debug('Performance metric recorded', logContext);
    }
  }

  /**
   * Get aggregated metrics for reporting
   */
  getActiveMetrics(): Array<{ id: string; name: MetricName; elapsed: number }> {
    const now = Date.now();
    return Array.from(this.metrics.entries()).map(([id, metric]) => ({
      id,
      name: metric.name,
      elapsed: now - metric.startTime,
    }));
  }
}

// Singleton instance
const monitor = new PerformanceMonitor();

/**
 * Timer interface for convenience
 */
export interface Timer {
  end: (context?: Record<string, unknown>) => number | null;
}

/**
 * Start a performance timer
 */
export function startTimer(name: MetricName, context?: Record<string, unknown>): Timer {
  const id = monitor.start(name, undefined, context);
  return {
    end: (additionalContext?: Record<string, unknown>) => monitor.end(id, additionalContext),
  };
}

/**
 * Record a completed metric
 */
export function recordMetric(
  name: MetricName,
  duration: number,
  context?: Record<string, unknown>
): void {
  monitor.record(name, duration, context);
}

/**
 * Get active metrics (for debugging)
 */
export function getActiveMetrics(): Array<{ id: string; name: MetricName; elapsed: number }> {
  return monitor.getActiveMetrics();
}

// Export the monitor for testing
export const performanceMonitor = monitor;
