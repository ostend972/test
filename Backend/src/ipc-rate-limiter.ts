/**
 * IPC Rate Limiter
 * Prevents abuse of IPC handlers by limiting request frequency
 */

interface RateLimitEntry {
    count: number;
    windowStart: number;
    blocked: boolean;
}

// Configuration
const RATE_LIMIT_CONFIG = {
    // Maximum requests per window
    maxRequests: 100,
    // Time window in milliseconds (1 second)
    windowMs: 1000,
    // How long to block after exceeding limit (5 seconds)
    blockDurationMs: 5000,
    // Handlers that are excluded from rate limiting
    excludedHandlers: [
        'getStats',           // Called frequently for dashboard
        'getProxyStatus',     // Called frequently for status
        'getLogs',            // Called frequently for log viewer
        'getHourlyAnalytics', // Called for charts
        'getDailyAnalytics',  // Called for charts
    ],
    // Handlers with stricter limits (expensive operations)
    strictHandlers: new Map<string, number>([
        ['updateBlocklists', 1],      // Max 1 per second
        ['repairSystemIntegrity', 1], // Max 1 per second
        ['forceUpdateThreatIntel', 1] // Max 1 per second
    ])
};

// Rate limit tracking per handler
const rateLimits = new Map<string, RateLimitEntry>();

// Stats tracking
let totalRequests = 0;
let blockedRequests = 0;
let lastResetTime = Date.now();

/**
 * Check if a request should be rate limited
 * @param handlerName The name of the IPC handler
 * @returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(handlerName: string): boolean {
    totalRequests++;
    const now = Date.now();

    // Excluded handlers are always allowed
    if (RATE_LIMIT_CONFIG.excludedHandlers.includes(handlerName)) {
        return true;
    }

    // Get or create rate limit entry
    let entry = rateLimits.get(handlerName);
    if (!entry) {
        entry = { count: 0, windowStart: now, blocked: false };
        rateLimits.set(handlerName, entry);
    }

    // Check if currently blocked
    if (entry.blocked) {
        if (now - entry.windowStart < RATE_LIMIT_CONFIG.blockDurationMs) {
            blockedRequests++;
            console.warn(`[IPC Rate Limiter] Handler "${handlerName}" is blocked (${RATE_LIMIT_CONFIG.blockDurationMs - (now - entry.windowStart)}ms remaining)`);
            return false;
        } else {
            // Block period ended, reset
            entry.blocked = false;
            entry.count = 0;
            entry.windowStart = now;
        }
    }

    // Check if window has expired
    if (now - entry.windowStart > RATE_LIMIT_CONFIG.windowMs) {
        entry.count = 0;
        entry.windowStart = now;
    }

    // Increment count
    entry.count++;

    // Get limit for this handler
    const limit = RATE_LIMIT_CONFIG.strictHandlers.get(handlerName) || RATE_LIMIT_CONFIG.maxRequests;

    // Check if over limit
    if (entry.count > limit) {
        entry.blocked = true;
        entry.windowStart = now; // Start block timer
        blockedRequests++;
        console.warn(`[IPC Rate Limiter] Rate limit exceeded for "${handlerName}" (${entry.count}/${limit}), blocking for ${RATE_LIMIT_CONFIG.blockDurationMs}ms`);
        return false;
    }

    return true;
}

/**
 * Get rate limiter statistics
 */
export function getRateLimiterStats(): {
    totalRequests: number;
    blockedRequests: number;
    activeBlocks: string[];
    uptime: number;
} {
    const now = Date.now();
    const activeBlocks: string[] = [];

    for (const [handler, entry] of rateLimits) {
        if (entry.blocked && now - entry.windowStart < RATE_LIMIT_CONFIG.blockDurationMs) {
            activeBlocks.push(handler);
        }
    }

    return {
        totalRequests,
        blockedRequests,
        activeBlocks,
        uptime: now - lastResetTime
    };
}

/**
 * Reset rate limiter statistics
 */
export function resetRateLimiterStats(): void {
    totalRequests = 0;
    blockedRequests = 0;
    lastResetTime = Date.now();
    rateLimits.clear();
    console.log('[IPC Rate Limiter] Statistics reset');
}

/**
 * Create a rate-limited wrapper for an IPC handler
 */
export function withRateLimit<T extends (...args: any[]) => any>(
    handlerName: string,
    handler: T
): T {
    return (async (...args: any[]) => {
        if (!checkRateLimit(handlerName)) {
            throw new Error(`Rate limit exceeded for ${handlerName}. Please wait a few seconds.`);
        }
        return handler(...args);
    }) as T;
}

// Clean up old entries periodically (every 60 seconds)
setInterval(() => {
    const now = Date.now();
    for (const [handler, entry] of rateLimits) {
        // Remove entries that haven't been accessed in 60 seconds
        if (now - entry.windowStart > 60000 && !entry.blocked) {
            rateLimits.delete(handler);
        }
    }
}, 60000);

console.log('[IPC Rate Limiter] Initialized with config:', {
    maxRequests: RATE_LIMIT_CONFIG.maxRequests,
    windowMs: RATE_LIMIT_CONFIG.windowMs,
    blockDurationMs: RATE_LIMIT_CONFIG.blockDurationMs
});
