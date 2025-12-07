/**
 * Circuit Breaker States
 * CLOSED: Normal operation, requests pass through
 * OPEN: Failures exceeded, requests fail immediately
 * HALF_OPEN: Testing if service recovered
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures before opening
  resetTimeout: number; // ms before attempting recovery
  monitoringInterval: number; // ms between health checks
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface SchwabPosition {
  symbol: string;
  quantity: number;
  price: number;
  marketValue: number;
  percentOfAccount: number;
}

interface SchwabAccount {
  accountNumber: string;
  accountType: string;
  isDayTrader: boolean;
  isClosingOnlyRestricted: boolean;
  positions?: SchwabPosition[];
  balances?: {
    accountValue: number;
    buyingPower: number;
    cashBalance: number;
    cashAvailableForTrading: number;
  };
}

/**
 * Response envelope for Schwab API responses
 * Can be used for consistent response handling patterns
 */
export interface SchwabApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

export class SchwabApiService {
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastStateChange: number = Date.now();
  private successCount: number = 0;

  private circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringInterval: 5000, // 5 seconds
  };

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  };

  constructor(
    private baseUrl: string,
    private accessToken: string,
  ) {}

  /**
   * Get account details including positions from Schwab
   * SC-003: Positions load in <30s (full refresh)
   * SC-004: Refresh in <3s (from cache)
   */
  async getAccountPositions(accountNumber: string): Promise<SchwabAccount> {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const response = await fetch(
          `${this.baseUrl}/accounts/${accountNumber}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        );

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          let errorCode = 'ACCOUNT_FETCH_FAILED';
          
          try {
            const errorText = await response.text();
            console.error('[getAccountPositions] Error response body:', errorText);
            
            if (errorText) {
              const error = JSON.parse(errorText);
              errorMessage = error.message || error.error || errorText;
              errorCode = error.code || error.error_code || errorCode;
            }
          } catch (parseError) {
            console.error('[getAccountPositions] Failed to parse error response:', parseError);
          }
          
          throw new SchwabApiError(
            `Failed to fetch account positions: ${errorMessage}`,
            response.status,
            errorCode,
          );
        }

        const data: SchwabAccount = await response.json();
        this.recordSuccess();
        return data;
      },
      'getAccountPositions',
    );
  }

  /**
   * Get list of all accounts linked to this OAuth token
   */
  async getLinkedAccounts(): Promise<SchwabAccount[]> {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const response = await fetch(`${this.baseUrl}/accounts`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          let errorCode = 'ACCOUNTS_LIST_FAILED';
          
          try {
            const errorText = await response.text();
            console.error('[getLinkedAccounts] Error response body:', errorText);
            
            if (errorText) {
              const error = JSON.parse(errorText);
              errorMessage = error.message || error.error || errorText;
              errorCode = error.code || error.error_code || errorCode;
            }
          } catch (parseError) {
            console.error('[getLinkedAccounts] Failed to parse error response:', parseError);
          }
          
          throw new SchwabApiError(
            `Failed to fetch linked accounts: ${errorMessage}`,
            response.status,
            errorCode,
          );
        }

        const data: SchwabAccount[] = await response.json();
        this.recordSuccess();
        return data;
      },
      'getLinkedAccounts',
    );
  }

  /**
   * Place order to buy/sell security
   * Used for cash deployment and rebalancing
   */
  async submitOrder(
    accountNumber: string,
    order: {
      symbol: string;
      quantity: number;
      instruction: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'LIMIT';
      price?: number;
    },
  ): Promise<{ orderId: string; status: string }> {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const response = await fetch(
          `${this.baseUrl}/accounts/${accountNumber}/orders`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(order),
          },
        );

        if (!response.ok) {
          const { message, code } = await this.parseErrorResponse(response, 'ORDER_SUBMISSION_FAILED');
          throw new SchwabApiError(
            `Failed to submit order: ${message}`,
            response.status,
            code,
          );
        }

        const data = await response.json();
        this.recordSuccess();
        return data;
      },
      'submitOrder',
    );
  }

  /**
   * Get order status
   */
  async getOrderStatus(
    accountNumber: string,
    orderId: string,
  ): Promise<{ orderId: string; status: string; filledQuantity: number }> {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const response = await fetch(
          `${this.baseUrl}/accounts/${accountNumber}/orders/${orderId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const { message, code } = await this.parseErrorResponse(response, 'ORDER_STATUS_FAILED');
          throw new SchwabApiError(
            `Failed to fetch order status: ${message}`,
            response.status,
            code,
          );
        }

        const data = await response.json();
        this.recordSuccess();
        return data;
      },
      'getOrderStatus',
    );
  }

  /**
   * Get historical price data for backtesting
   * SC-008: 5yr backtest <5s (with caching)
   */
  async getHistoricalPrices(
    symbol: string,
    startDate: string,
    endDate: string,
    frequencyType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<
    Array<{
      datetime: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  > {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const params = new URLSearchParams({
          symbol,
          periodType: 'year',
          frequencyType,
          startDate,
          endDate,
          needPlus: 'false',
        });

        const response = await fetch(
          `${this.baseUrl}/marketdata/candles?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const { message, code } = await this.parseErrorResponse(response, 'PRICE_DATA_FAILED');
          throw new SchwabApiError(
            `Failed to fetch historical prices: ${message}`,
            response.status,
            code,
          );
        }

        const data = await response.json();
        this.recordSuccess();
        return data.candles || [];
      },
      'getHistoricalPrices',
    );
  }

  /**
   * Search for ticker symbol in Schwab
   * Used for portfolio ticker validation
   */
  async searchInstrument(
    symbol: string,
  ): Promise<
    Array<{
      symbol: string;
      description: string;
      assetType: string;
    }>
  > {
    return this.executeWithRetry(
      async () => {
        this.checkCircuitBreaker();

        const response = await fetch(
          `${this.baseUrl}/instruments?symbol=${symbol}&projection=symbol-search`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          const { message, code } = await this.parseErrorResponse(response, 'INSTRUMENT_SEARCH_FAILED');
          throw new SchwabApiError(
            `Failed to search instrument: ${message}`,
            response.status,
            code,
          );
        }

        const data = await response.json();
        this.recordSuccess();
        return data.instruments || [];
      },
      'searchInstrument',
    );
  }

  /**
   * Helper method to safely parse error responses from Schwab API
   */
  private async parseErrorResponse(
    response: Response,
    defaultErrorCode: string,
  ): Promise<{ message: string; code: string }> {
    let errorMessage = 'Unknown error';
    let errorCode = defaultErrorCode;

    try {
      const errorText = await response.text();
      console.error('[SchwabApi] Error response body:', errorText, 'Status:', response.status);

      if (errorText) {
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || error.error || errorText;
          errorCode = error.code || error.error_code || errorCode;
        } catch {
          errorMessage = errorText;
        }
      }
    } catch (parseError) {
      console.error('[SchwabApi] Failed to parse error response:', parseError);
    }

    return { message: errorMessage, code: errorCode };
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (
          error instanceof SchwabApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          this.recordFailure();
          throw error;
        }

        // For 5xx errors or network errors, retry with backoff
        if (attempt < this.retryConfig.maxRetries) {
          console.warn(
            `[${operationName}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
            error,
          );

          await this.sleep(delay);
          delay = Math.min(
            delay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelayMs,
          );
        } else {
          this.recordFailure();
          throw new SchwabApiError(
            `Failed after ${this.retryConfig.maxRetries} retries: ${lastError?.message}`,
            0,
            'MAX_RETRIES_EXCEEDED',
          );
        }
      }
    }

    throw lastError || new Error('Unknown error during retry execution');
  }

  /**
   * Check circuit breaker state and throw if OPEN
   * Implements circuit breaker pattern:
   * - CLOSED: Normal operation
   * - OPEN: Fail fast, service likely down
   * - HALF_OPEN: Testing recovery
   */
  private checkCircuitBreaker(): void {
    if (this.circuitState === CircuitState.CLOSED) {
      return;
    }

    if (this.circuitState === CircuitState.OPEN) {
      const timeSinceChange = Date.now() - this.lastStateChange;

      if (timeSinceChange >= this.circuitBreakerConfig.resetTimeout) {
        // Attempt recovery
        this.transitionState(CircuitState.HALF_OPEN);
        // Transitioning to HALF_OPEN, testing recovery...
        return;
      }

      throw new SchwabApiError(
        'Schwab API service is temporarily unavailable (circuit breaker open)',
        503,
        'SERVICE_UNAVAILABLE',
      );
    }

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Allow one request through to test
      return;
    }
  }

  /**
   * Record successful API call
   */
  private recordSuccess(): void {
    this.failureCount = 0;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.successCount++;

      // After 2 consecutive successes in HALF_OPEN, return to CLOSED
      if (this.successCount >= 2) {
        this.transitionState(CircuitState.CLOSED);
        // Service recovered, transitioning to CLOSED
        this.successCount = 0;
      }
    }
  }

  /**
   * Record failed API call
   */
  private recordFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (
      this.circuitState === CircuitState.HALF_OPEN ||
      this.failureCount >= this.circuitBreakerConfig.failureThreshold
    ) {
      this.transitionState(CircuitState.OPEN);
      console.error(
        `[CircuitBreaker] Failure threshold exceeded (${this.failureCount}/${this.circuitBreakerConfig.failureThreshold}), transitioning to OPEN`,
      );
    }
  }

  /**
   * Transition circuit breaker state
   */
  private transitionState(newState: CircuitState): void {
    this.circuitState = newState;
    this.lastStateChange = Date.now();
  }

  /**
   * Utility sleep function for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker state (for monitoring)
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get failure count (for monitoring)
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Custom error class for Schwab API errors
 */
export class SchwabApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = 'SchwabApiError';
  }
}
