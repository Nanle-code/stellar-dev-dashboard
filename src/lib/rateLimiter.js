/**
 * Rate Limiting Utilities
 * Implements token bucket algorithm for API rate limiting
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // Default: 1 minute
    this.maxRequests = options.maxRequests || 30; // Default: 30 requests per minute
    this.buckets = new Map(); // Store tokens per user/IP
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   * @param {string} identifier - User ID or IP address
   * @returns {object} Result with allowed status and remaining requests
   */
  check(identifier) {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);
    
    if (!bucket) {
      // Create new bucket
      bucket = {
        tokens: this.maxRequests - 1,
        lastRefill: now,
      };
      this.buckets.set(identifier, bucket);
      
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetTime: now + this.windowMs,
      };
    }
    
    // Refill tokens based on time elapsed
    const elapsed = now - bucket.lastRefill;
    const refillAmount = Math.floor(elapsed / this.windowMs) * this.maxRequests;
    
    if (refillAmount > 0) {
      bucket.tokens = Math.min(this.maxRequests, bucket.tokens + refillAmount);
      bucket.lastRefill = now;
    }
    
    // Check if request is allowed
    if (bucket.tokens > 0) {
      bucket.tokens--;
      
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetTime: bucket.lastRefill + this.windowMs,
      };
    }
    
    // Rate limited
    const resetTime = bucket.lastRefill + this.windowMs;
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter,
    };
  }

  /**
   * Get remaining requests for identifier
   * @param {string} identifier - User ID or IP address
   * @returns {number} Remaining requests
   */
  getRemaining(identifier) {
    const bucket = this.buckets.get(identifier);
    if (!bucket) return this.maxRequests;
    return bucket.tokens;
  }

  /**
   * Reset rate limit for identifier
   * @param {string} identifier - User ID or IP address
   */
  reset(identifier) {
    this.buckets.delete(identifier);
  }

  /**
   * Clean up expired buckets (older than windowMs)
   */
  cleanup() {
    const now = Date.now();
    for (const [identifier, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.windowMs) {
        this.buckets.delete(identifier);
      }
    }
  }

  /**
   * Get rate limit status
   * @param {string} identifier - User ID or IP address
   * @returns {object} Status object
   */
  getStatus(identifier) {
    const bucket = this.buckets.get(identifier);
    if (!bucket) {
      return {
        remaining: this.maxRequests,
        limit: this.maxRequests,
        resetTime: Date.now() + this.windowMs,
      };
    }
    
    return {
      remaining: bucket.tokens,
      limit: this.maxRequests,
      resetTime: bucket.lastRefill + this.windowMs,
    };
  }
}

// Create default rate limiter instance
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 30,
});

// Create stricter rate limiter for expensive operations
const strictRateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

// Create very strict rate limiter for write operations
const writeRateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 5,
});

export default rateLimiter;
export { rateLimiter, strictRateLimiter, writeRateLimiter, RateLimiter };
