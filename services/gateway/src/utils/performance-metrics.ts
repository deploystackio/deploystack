/**
 * Performance metrics tracking for device info caching system
 */
export class PerformanceMetrics {
  private static metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalDeviceDetectionCalls: 0,
    totalCacheTime: 0,
    totalFreshGenerationTime: 0,
    cacheErrors: 0
  };

  /**
   * Record a cache hit (device info retrieved from cache)
   * @param duration Time taken to retrieve from cache in milliseconds
   */
  static recordCacheHit(duration: number): void {
    this.metrics.cacheHits++;
    this.metrics.totalDeviceDetectionCalls++;
    this.metrics.totalCacheTime += duration;
  }

  /**
   * Record a cache miss (device info generated fresh)
   * @param duration Time taken to generate fresh device info in milliseconds
   */
  static recordCacheMiss(duration: number): void {
    this.metrics.cacheMisses++;
    this.metrics.totalDeviceDetectionCalls++;
    this.metrics.totalFreshGenerationTime += duration;
  }

  /**
   * Record a cache error
   */
  static recordCacheError(): void {
    this.metrics.cacheErrors++;
  }

  /**
   * Get current performance metrics
   */
  static getMetrics() {
    const totalCalls = this.metrics.totalDeviceDetectionCalls;
    const cacheHitRate = totalCalls > 0 ? (this.metrics.cacheHits / totalCalls) * 100 : 0;
    const avgCacheTime = this.metrics.cacheHits > 0 ? this.metrics.totalCacheTime / this.metrics.cacheHits : 0;
    const avgFreshTime = this.metrics.cacheMisses > 0 ? this.metrics.totalFreshGenerationTime / this.metrics.cacheMisses : 0;
    const performanceImprovement = avgFreshTime > 0 && avgCacheTime > 0 ? avgFreshTime / avgCacheTime : 0;

    return {
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      totalCalls: totalCalls,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100, // Round to 2 decimal places
      cacheErrors: this.metrics.cacheErrors,
      avgCacheTime: Math.round(avgCacheTime * 100) / 100,
      avgFreshTime: Math.round(avgFreshTime * 100) / 100,
      performanceImprovement: Math.round(performanceImprovement * 100) / 100
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  static reset(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalDeviceDetectionCalls: 0,
      totalCacheTime: 0,
      totalFreshGenerationTime: 0,
      cacheErrors: 0
    };
  }

  /**
   * Log performance summary to console
   */
  static logSummary(): void {
    const metrics = this.getMetrics();
    
    if (metrics.totalCalls === 0) {
      console.log('📊 Device Cache Performance: No device detection calls recorded');
      return;
    }

    console.log('📊 Device Cache Performance Summary:');
    console.log(`   Cache Hit Rate: ${metrics.cacheHitRate}% (${metrics.cacheHits}/${metrics.totalCalls})`);
    console.log(`   Average Cache Time: ${metrics.avgCacheTime}ms`);
    console.log(`   Average Fresh Generation Time: ${metrics.avgFreshTime}ms`);
    
    if (metrics.performanceImprovement > 1) {
      console.log(`   Performance Improvement: ${metrics.performanceImprovement}x faster`);
    }
    
    if (metrics.cacheErrors > 0) {
      console.log(`   Cache Errors: ${metrics.cacheErrors}`);
    }
  }
}
