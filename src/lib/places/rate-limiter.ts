/**
 * Rate limiting utilities for API calls
 */

export class RateLimiter {
  private lastCallTime: number = 0;
  private callCount: number = 0;
  private resetTime: number = Date.now();

  constructor(
    private minDelayMs: number = 100, // Minimum delay between calls
    private maxCallsPerMinute: number = 60 // Max calls per minute
  ) {}

  /**
   * Wait if necessary to respect rate limits
   */
  async throttle(): Promise<void> {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.resetTime >= 60000) {
      this.callCount = 0;
      this.resetTime = now;
    }

    // Check if we've exceeded max calls per minute
    if (this.callCount >= this.maxCallsPerMinute) {
      const waitTime = 60000 - (now - this.resetTime);
      if (waitTime > 0) {
        await this.delay(waitTime);
        this.callCount = 0;
        this.resetTime = Date.now();
      }
    }

    // Ensure minimum delay between calls
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelayMs) {
      await this.delay(this.minDelayMs - timeSinceLastCall);
    }

    this.lastCallTime = Date.now();
    this.callCount++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    return {
      callCount: this.callCount,
      resetTime: this.resetTime,
      remainingCalls: this.maxCallsPerMinute - this.callCount,
    };
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      const errorMessage = lastError.message.toLowerCase();
      if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden')
      ) {
        throw lastError;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate backoff delay (exponential with jitter)
      const backoffDelay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * backoffDelay; // ±30% jitter
      const delay = backoffDelay + jitter;

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
