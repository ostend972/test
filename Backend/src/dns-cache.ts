/**
 * DNS Cache for Proxy
 *
 * Performance: Saves 50-200ms per domain lookup
 * Impact: Massive for frequently accessed domains (Google, Facebook, etc.)
 */

import dns from 'dns/promises';

interface DNSCacheEntry {
    ip: string;
    expires: number;
}

const dnsCache = new Map<string, DNSCacheEntry>();
const DNS_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 10000;

// Cleanup interval
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [domain, entry] of dnsCache.entries()) {
        if (now > entry.expires) {
            dnsCache.delete(domain);
            cleaned++;
        }
    }

    // Enforce size limit (LRU-like)
    if (dnsCache.size > MAX_CACHE_SIZE) {
        const toDelete = dnsCache.size - MAX_CACHE_SIZE;
        const keys = Array.from(dnsCache.keys()).slice(0, toDelete);
        keys.forEach(k => dnsCache.delete(k));
        cleaned += toDelete;
    }

    if (cleaned > 0) {
        console.log(`[DNS Cache] Cleaned ${cleaned} expired entries`);
    }
}, 60000); // Every minute

/**
 * Resolve domain with caching
 */
export async function resolveCached(domain: string): Promise<string | null> {
    // Check cache first
    const cached = dnsCache.get(domain);
    if (cached && Date.now() < cached.expires) {
        return cached.ip;
    }

    // Resolve DNS
    try {
        const addresses = await dns.resolve4(domain);
        if (addresses && addresses.length > 0) {
            const ip = addresses[0];

            // Cache result
            dnsCache.set(domain, {
                ip,
                expires: Date.now() + DNS_TTL
            });

            return ip;
        }
    } catch (error: any) {
        // DNS lookup failed - don't cache failures
        console.error(`[DNS Cache] Failed to resolve ${domain}:`, error.message);
        return null;
    }

    return null;
}

/**
 * Preload DNS for popular domains
 */
export async function preloadPopularDomains() {
    const popularDomains = [
        'google.com',
        'facebook.com',
        'youtube.com',
        'twitter.com',
        'amazon.com',
        'reddit.com',
        'instagram.com',
        'linkedin.com',
        'github.com',
        'stackoverflow.com'
    ];

    console.log('[DNS Cache] Preloading popular domains...');

    const promises = popularDomains.map(domain => resolveCached(domain));
    await Promise.allSettled(promises);

    console.log(`[DNS Cache] Preloaded ${dnsCache.size} domains`);
}

/**
 * Get cache statistics
 */
export function getDNSCacheStats() {
    const now = Date.now();
    let validEntries = 0;

    for (const entry of dnsCache.values()) {
        if (now < entry.expires) {
            validEntries++;
        }
    }

    return {
        totalEntries: dnsCache.size,
        validEntries,
        expiredEntries: dnsCache.size - validEntries
    };
}

export default {
    resolveCached,
    preloadPopularDomains,
    getDNSCacheStats
};
