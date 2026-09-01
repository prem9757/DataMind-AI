/**
 * Multi-Tier Intelligent Caching Engine
 * Caches dataset profiles, data quality audits, EDA results, statistical tests,
 * ML results, reports, and deterministic AI responses.
 * Automatically invalidates cache entries when the dataset version updates.
 */

interface CacheEntry<T = any> {
  key: string;
  datasetId: string;
  datasetVersion: number | string;
  category: string;
  data: T;
  createdAt: number;
  lastAccessed: number;
  sizeEstimateBytes: number;
  hits: number;
}

class CacheEngine {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number = 200;
  private totalHits: number = 0;
  private totalMisses: number = 0;

  private generateKey(
    datasetId: string,
    datasetVersion: number | string,
    category: string,
    params: any = {}
  ): string {
    const serializedParams = typeof params === 'string' ? params : JSON.stringify(params || {});
    return `${datasetId}_v${datasetVersion}_${category}_${serializedParams}`;
  }

  /**
   * Retrieve cached item if exists and matches dataset version
   */
  public get<T>(
    datasetId: string,
    datasetVersion: number | string,
    category: string,
    params: any = {}
  ): T | null {
    const key = this.generateKey(datasetId, datasetVersion, category, params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.totalMisses++;
      return null;
    }

    // Verify dataset version alignment
    if (String(entry.datasetVersion) !== String(datasetVersion)) {
      this.cache.delete(key);
      this.totalMisses++;
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.hits++;
    this.totalHits++;
    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  public set<T>(
    datasetId: string,
    datasetVersion: number | string,
    category: string,
    params: any = {},
    data: T
  ): void {
    // Evict oldest if exceeding capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(datasetId, datasetVersion, category, params);
    const sizeEstimate = this.estimateSize(data);

    this.cache.set(key, {
      key,
      datasetId,
      datasetVersion,
      category,
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      sizeEstimateBytes: sizeEstimate,
      hits: 0
    });
  }

  /**
   * Invalidate all entries for a given dataset when its version changes
   */
  public invalidateDataset(datasetId: string, keepVersion?: number | string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.datasetId === datasetId) {
        if (keepVersion === undefined || String(entry.datasetVersion) !== String(keepVersion)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Invalidate specific category for a dataset
   */
  public invalidateCategory(datasetId: string, category: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.datasetId === datasetId && entry.category === category) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Get cache statistics & hit rate
   */
  public getStats() {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;
    let totalSizeBytes = 0;

    for (const entry of this.cache.values()) {
      totalSizeBytes += entry.sizeEstimateBytes;
    }

    return {
      entryCount: this.cache.size,
      maxEntries: this.maxEntries,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: parseFloat(hitRate.toFixed(1)),
      estimatedMemoryMB: parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2))
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private estimateSize(obj: any): number {
    try {
      const str = JSON.stringify(obj);
      return str.length * 2; // Approximate byte size for UTF-16
    } catch {
      return 1024;
    }
  }
}

export const globalCache = new CacheEngine();
