/**
 * Exponential Backoff Utility for Google API Rate Limiting
 * Implements intelligent retry logic with exponential delays
 */

class ExponentialBackoff {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000;  // 30 seconds
    this.maxRetries = options.maxRetries || 5;
    this.multiplier = options.multiplier || 2;
    this.jitter = options.jitter !== false; // Add randomization by default
  }

  /**
   * Execute a function with exponential backoff retry logic
   * @param {Function} fn - The function to execute
   * @param {Object} context - Context for logging/debugging
   * @returns {Promise} The result of the function execution
   */
  async execute(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          console.log(`✅ Google API call succeeded on attempt ${attempt + 1}:`, context);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable error
        if (!this.isRetryableError(error)) {
          console.error('❌ Non-retryable Google API error:', error.message, context);
          throw error;
        }
        
        // If this was our last attempt, throw the error
        if (attempt === this.maxRetries - 1) {
          console.error(`❌ Google API failed after ${this.maxRetries} attempts:`, error.message, context);
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        
        console.warn(`⚠️ Google API error (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms:`, {
          error: error.message,
          statusCode: error.code || error.status,
          context
        });
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Determine if an error is worth retrying
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    // Google API error codes that warrant retry
    const retryableCodes = [
      429, // Rate limit exceeded
      500, // Internal server error
      502, // Bad gateway
      503, // Service unavailable
      504, // Gateway timeout
    ];
    
    // Check HTTP status codes
    if (error.code && retryableCodes.includes(error.code)) {
      return true;
    }
    
    if (error.status && retryableCodes.includes(error.status)) {
      return true;
    }
    
    // Check error messages for specific patterns
    const retryableMessages = [
      'RATE_LIMIT_EXCEEDED',
      'quotaExceeded',
      'rateLimitExceeded',
      'backendError',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'socket hang up'
    ];
    
    const errorMessage = error.message || '';
    return retryableMessages.some(pattern => 
      errorMessage.includes(pattern)
    );
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Calculate base exponential delay
    let delay = Math.min(
      this.baseDelay * Math.pow(this.multiplier, attempt),
      this.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    if (this.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.round(delay);
  }

  /**
   * Simple delay helper
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after the delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ExponentialBackoff;
