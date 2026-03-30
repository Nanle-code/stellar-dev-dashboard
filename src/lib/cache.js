/**
 * Intelligent Caching System
 * Provides in-memory caching with TTL, automatic cleanup, and LRU eviction
 */

class Cache {
  constructor(maxSize = 1000, defaultTTL = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize; // Maximum number of items in cache
    this.defaultTTL = defaultTTL; // Default TTL in milliseconds (60 seconds)
    this.hits = 0;
    this.misses = 0;
    
    // Start periodic cleanup every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Generate a cache key from parameters
   * @param {string} prefix - Key prefix (e.g., 'account', 'transaction')
   * @param {any} params - Parameters to include in key
   * @returns {string} Cache key
   */
  generateKey(prefix, params) {
    const key = `${prefix}:${JSON.stringify(params)}`;
    return key;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    // Check if we need to evict old items
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return item.value;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict oldest items when cache is full
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove expired items from cache
   */
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      total: total,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Get all keys in cache (for debugging)
   * @returns {Array} Array of keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }
}

// Create singleton instance
const cache = new Cache();

// Export for use in other modules
export default cache;
export { Cache };
