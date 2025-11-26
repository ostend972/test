/**
 * Bloom Filter for Ultra-Fast Domain Lookups
 *
 * Performance: O(1) vs O(log n) for negative lookups
 * Memory: ~1MB for 3M domains with 1% false positive rate
 *
 * Use case: 99% of traffic goes to non-blocked domains
 * With Bloom filter: Instant rejection without touching DB
 */

import { BloomFilter } from 'bloom-filters';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let blocklistBloomFilter: BloomFilter | null = null;
let whitelistBloomFilter: BloomFilter | null = null;

const BLOOM_CACHE_PATH = path.join(app.getPath('userData'), 'bloom-filters.cache');

interface BloomStats {
    blocklistSize: number;
    whitelistSize: number;
    errorRate: number;
    memoryMB: number;
    initialized: boolean;
}

/**
 * Save Bloom filters to disk for instant loading next time
 */
export function saveBloomFiltersToCache(): void {
    try {
        if (!blocklistBloomFilter && !whitelistBloomFilter) {
            return;
        }

        const cacheData = {
            blocklist: blocklistBloomFilter ? blocklistBloomFilter.saveAsJSON() : null,
            whitelist: whitelistBloomFilter ? whitelistBloomFilter.saveAsJSON() : null,
            timestamp: Date.now()
        };

        fs.writeFileSync(BLOOM_CACHE_PATH, JSON.stringify(cacheData));
        console.log('[BloomFilter] ✓ Saved to cache:', BLOOM_CACHE_PATH);
    } catch (error: any) {
        console.error('[BloomFilter] ✗ Failed to save cache:', error.message);
    }
}

/**
 * Load Bloom filters from disk cache (instant)
 * Returns true if successfully loaded, false otherwise
 */
export function loadBloomFiltersFromCache(): boolean {
    try {
        if (!fs.existsSync(BLOOM_CACHE_PATH)) {
            console.log('[BloomFilter] No cache file found');
            return false;
        }

        const cacheData = JSON.parse(fs.readFileSync(BLOOM_CACHE_PATH, 'utf-8'));

        // Load blocklist filter
        if (cacheData.blocklist) {
            blocklistBloomFilter = BloomFilter.fromJSON(cacheData.blocklist);
        }

        // Load whitelist filter
        if (cacheData.whitelist) {
            whitelistBloomFilter = BloomFilter.fromJSON(cacheData.whitelist);
        }

        const age = Date.now() - cacheData.timestamp;
        console.log('[BloomFilter] ✓ Loaded from cache (age:', Math.round(age / 1000 / 60), 'minutes)');
        return true;
    } catch (error: any) {
        console.error('[BloomFilter] ✗ Failed to load cache:', error.message);
        return false;
    }
}

/**
 * Initialize Bloom filters from database
 * Call this once at startup and when lists are updated
 */
export function initializeBloomFilters(
    blocklistDomains: string[],
    whitelistDomains: string[]
): BloomStats {
    const errorRate = 0.01; // 1% false positive is acceptable

    console.log('[BloomFilter] Initializing with', {
        blocklist: blocklistDomains.length,
        whitelist: whitelistDomains.length
    });

    const startTime = Date.now();

    // Create blocklist filter
    if (blocklistDomains.length > 0) {
        blocklistBloomFilter = BloomFilter.create(blocklistDomains.length, errorRate);
        blocklistDomains.forEach(domain => {
            blocklistBloomFilter!.add(domain);
        });
    }

    // Create whitelist filter
    if (whitelistDomains.length > 0) {
        whitelistBloomFilter = BloomFilter.create(whitelistDomains.length, errorRate);
        whitelistDomains.forEach(domain => {
            whitelistBloomFilter!.add(domain);
        });
    }

    const duration = Date.now() - startTime;

    // Estimate memory usage (bits / 8 / 1024 / 1024 for MB)
    const blocklistMemory = blocklistBloomFilter
        ? (blocklistBloomFilter as any)._size / 8 / 1024 / 1024
        : 0;
    const whitelistMemory = whitelistBloomFilter
        ? (whitelistBloomFilter as any)._size / 8 / 1024 / 1024
        : 0;
    const totalMemory = blocklistMemory + whitelistMemory;

    const stats: BloomStats = {
        blocklistSize: blocklistDomains.length,
        whitelistSize: whitelistDomains.length,
        errorRate,
        memoryMB: totalMemory,
        initialized: true
    };

    console.log('[BloomFilter] ✓ Initialized in', duration, 'ms');
    console.log('[BloomFilter] Memory usage:', totalMemory.toFixed(2), 'MB');
    console.log('[BloomFilter] False positive rate:', (errorRate * 100).toFixed(1), '%');

    // Save to cache for next startup
    saveBloomFiltersToCache();

    return stats;
}

/**
 * Ultra-fast check if domain MIGHT be in blocklist
 * Returns:
 *   - true: Domain MIGHT be blocked (check DB to confirm)
 *   - false: Domain is DEFINITELY NOT blocked (skip DB)
 *
 * Performance: ~100-1000x faster than DB lookup for negative cases
 */
export function mightBeBlocked(domain: string): boolean {
    if (!blocklistBloomFilter) {
        return true; // If not initialized, assume might be blocked
    }

    return blocklistBloomFilter.has(domain);
}

/**
 * Ultra-fast check if domain MIGHT be in whitelist
 */
export function mightBeWhitelisted(domain: string): boolean {
    if (!whitelistBloomFilter) {
        return false;
    }

    return whitelistBloomFilter.has(domain);
}

/**
 * Get Bloom filter statistics
 */
export function getBloomStats(): BloomStats | null {
    if (!blocklistBloomFilter && !whitelistBloomFilter) {
        return null;
    }

    return {
        blocklistSize: blocklistBloomFilter ? (blocklistBloomFilter as any)._length : 0,
        whitelistSize: whitelistBloomFilter ? (whitelistBloomFilter as any)._length : 0,
        errorRate: 0.01,
        memoryMB: 0, // Calculated on init
        initialized: true
    };
}

/**
 * Clear filters (useful for testing or reinitialization)
 */
export function clearBloomFilters(): void {
    blocklistBloomFilter = null;
    whitelistBloomFilter = null;
    console.log('[BloomFilter] Cleared');
}

export default {
    initializeBloomFilters,
    loadBloomFiltersFromCache,
    saveBloomFiltersToCache,
    mightBeBlocked,
    mightBeWhitelisted,
    getBloomStats,
    clearBloomFilters
};
