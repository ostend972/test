import https from 'https';
import http from 'http';
import { URL } from 'url';

export interface DownloadProgress {
    source: string;
    status: 'downloading' | 'parsing' | 'complete' | 'error' | 'retrying';
    domains?: number;
    urls?: number;
    error?: string;
    retryCount?: number;
    nextRetryIn?: number;
}

// ============================================================================
// RETRY CONFIGURATION - Exponential Backoff
// ============================================================================
const RETRY_CONFIG = {
    maxRetries: 5,
    initialDelayMs: 1000,      // 1 second
    maxDelayMs: 60000,         // 60 seconds max
    backoffMultiplier: 2       // Double delay each retry
};

// ============================================================================
// VALIDATION CONFIGURATION
// ============================================================================
const VALIDATION_CONFIG = {
    minEntries: 10,            // Minimum valid entries expected
    maxEntries: 20000000,      // Maximum entries (20M) - sanity check
    minValidRatio: 0.5,        // At least 50% of non-empty lines should be valid
    minContentSize: 100        // Minimum content size in bytes
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for retry with exponential backoff
 */
function getRetryDelay(retryCount: number): number {
    const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
    return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Downloads content from a URL
 */
export function downloadList(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log(`[BlocklistUpdater] Initiating download from: ${url}`);

        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        console.log(`[BlocklistUpdater] Using ${parsedUrl.protocol.replace(':', '').toUpperCase()} protocol`);

        const startTime = Date.now();
        let receivedBytes = 0;

        const request = client.get(url, { timeout: 60000 }, (res) => {
            console.log(`[BlocklistUpdater] Server responded with status: ${res.statusCode} ${res.statusMessage}`);

            if (res.statusCode !== 200) {
                console.error(`[BlocklistUpdater] ✗ Download failed with HTTP ${res.statusCode}: ${res.statusMessage}`);
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            console.log(`[BlocklistUpdater] Content-Type: ${res.headers['content-type'] || 'unknown'}`);
            console.log(`[BlocklistUpdater] Content-Length: ${res.headers['content-length'] || 'unknown'} bytes`);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
                receivedBytes += chunk.length;
            });

            res.on('end', () => {
                const duration = Date.now() - startTime;
                console.log(`[BlocklistUpdater] ✓ Download completed successfully`);
                console.log(`[BlocklistUpdater] Downloaded ${receivedBytes.toLocaleString()} bytes in ${duration}ms (${(receivedBytes / 1024 / 1024).toFixed(2)} MB)`);
                console.log(`[BlocklistUpdater] Download speed: ${(receivedBytes / 1024 / (duration / 1000)).toFixed(2)} KB/s`);
                resolve(data);
            });
        });

        request.on('error', (err) => {
            console.error(`[BlocklistUpdater] ✗ Download error:`, err.message);
            if (err.message.includes('ENOTFOUND')) {
                console.error(`[BlocklistUpdater] DNS lookup failed - domain not found`);
            } else if (err.message.includes('ECONNREFUSED')) {
                console.error(`[BlocklistUpdater] Connection refused by server`);
            } else if (err.message.includes('ETIMEDOUT')) {
                console.error(`[BlocklistUpdater] Connection timed out`);
            }
            reject(err);
        });

        request.on('timeout', () => {
            console.error(`[BlocklistUpdater] ✗ Download timeout after 60 seconds`);
            console.error(`[BlocklistUpdater] Received ${receivedBytes.toLocaleString()} bytes before timeout`);
            request.destroy();
            reject(new Error('Download timeout (60s)'));
        });
    });
}

/**
 * Parses blocklist content in chunks to avoid blocking the event loop
 * Returns both domains and URLs separately
 */
export async function parseBlocklist(content: string, sourceId: string): Promise<{ domains: string[]; urls: string[] }> {
    console.log(`[BlocklistUpdater] Starting to parse content for source: ${sourceId}`);

    const domains = new Set<string>();
    const urls = new Set<string>();
    const lines = content.split('\n');

    console.log(`[BlocklistUpdater] Total lines to process: ${lines.length.toLocaleString()}`);

    // Auto-detect if this is a URL list or domain list
    const isUrlList = sourceId === 'urlhaus' || sourceId === 'openphish';
    console.log(`[BlocklistUpdater] Detected format: ${isUrlList ? 'URL list' : 'Domain list'}`);

    let emptyLines = 0;
    let commentLines = 0;
    let validEntries = 0;
    let invalidEntries = 0;
    let hostsFormatCount = 0;

    // Process in chunks to avoid blocking the event loop
    const CHUNK_SIZE = 5000; // Process 5000 lines at a time
    const totalChunks = Math.ceil(lines.length / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, lines.length);
        const chunk = lines.slice(start, end);

        // Process chunk
        for (let line of chunk) {
            line = line.trim();

            // Skip empty lines and comments
            if (!line) {
                emptyLines++;
                continue;
            }

            if (line.startsWith('#') || line.startsWith('//') || line.startsWith('!')) {
                commentLines++;
                continue;
            }

            if (isUrlList) {
                // URLhaus & OpenPhish: Full URLs
                if (line.startsWith('http://') || line.startsWith('https://')) {
                    try {
                        // Validate URL
                        new URL(line);
                        urls.add(line);
                        validEntries++;
                    } catch {
                        // Invalid URL, skip
                        invalidEntries++;
                    }
                } else {
                    invalidEntries++;
                }
            } else {
                // AdBlock Plus format: ||domain^
                if (line.startsWith('||') && line.includes('^')) {
                    const domain = line.substring(2, line.indexOf('^')).trim();
                    if (isValidDomain(domain)) {
                        domains.add(domain.toLowerCase());
                        validEntries++;
                    } else {
                        invalidEntries++;
                    }
                    continue;
                }

                // Python list format: "domain.com",
                const pythonMatch = line.match(/^["']([^"']+)["'],?\s*$/);
                if (pythonMatch) {
                    let domain = pythonMatch[1].trim();
                    // Remove wildcard prefix
                    if (domain.startsWith('*.')) {
                        domain = domain.substring(2);
                    }
                    if (isValidDomain(domain)) {
                        domains.add(domain.toLowerCase());
                        validEntries++;
                    } else {
                        invalidEntries++;
                    }
                    continue;
                }

                // HaGeZi: hosts file format (0.0.0.0 domain.com)
                const hostsMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(.+)$/);
                if (hostsMatch) {
                    hostsFormatCount++;
                    const domain = hostsMatch[1].trim();
                    // Remove trailing comments
                    const cleanDomain = domain.split('#')[0].trim();
                    if (isValidDomain(cleanDomain)) {
                        domains.add(cleanDomain.toLowerCase());
                        validEntries++;
                    } else {
                        invalidEntries++;
                    }
                    continue;
                }

                // Simple domain list fallback
                const cleanLine = line.split('#')[0].trim();
                if (isValidDomain(cleanLine)) {
                    domains.add(cleanLine.toLowerCase());
                    validEntries++;
                } else {
                    invalidEntries++;
                }
            }
        }

        // Let the event loop breathe every chunk
        if (chunkIndex < totalChunks - 1) {
            await new Promise(resolve => setImmediate(resolve));
        }
    }

    console.log(`[BlocklistUpdater] Parsing complete for ${sourceId}:`);
    console.log(`[BlocklistUpdater]   - Empty lines: ${emptyLines.toLocaleString()}`);
    console.log(`[BlocklistUpdater]   - Comment lines: ${commentLines.toLocaleString()}`);
    console.log(`[BlocklistUpdater]   - Valid entries: ${validEntries.toLocaleString()}`);
    console.log(`[BlocklistUpdater]   - Invalid/skipped entries: ${invalidEntries.toLocaleString()}`);
    if (!isUrlList && hostsFormatCount > 0) {
        console.log(`[BlocklistUpdater]   - Hosts file format lines: ${hostsFormatCount.toLocaleString()}`);
    }
    console.log(`[BlocklistUpdater] ✓ Extracted ${domains.size} unique domains and ${urls.size} unique URLs`);

    return {
        domains: Array.from(domains),
        urls: Array.from(urls)
    };
}

/**
 * Basic domain validation
 */
function isValidDomain(domain: string): boolean {
    // Basic domain regex
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

    return domainRegex.test(domain) &&
        domain.length > 0 &&
        domain.length < 256 &&
        !domain.startsWith('.') &&
        !domain.endsWith('.');
}

/**
 * Validates parsed blocklist results
 */
function validateBlocklistResult(
    result: { domains: string[]; urls: string[] },
    content: string,
    sourceId: string
): { valid: boolean; reason?: string } {
    const totalEntries = result.domains.length + result.urls.length;

    // Check minimum entries
    if (totalEntries < VALIDATION_CONFIG.minEntries) {
        return {
            valid: false,
            reason: `Too few entries: ${totalEntries} (minimum: ${VALIDATION_CONFIG.minEntries})`
        };
    }

    // Check maximum entries (sanity check)
    if (totalEntries > VALIDATION_CONFIG.maxEntries) {
        return {
            valid: false,
            reason: `Too many entries: ${totalEntries} (maximum: ${VALIDATION_CONFIG.maxEntries})`
        };
    }

    // Check content size
    if (content.length < VALIDATION_CONFIG.minContentSize) {
        return {
            valid: false,
            reason: `Content too small: ${content.length} bytes (minimum: ${VALIDATION_CONFIG.minContentSize})`
        };
    }

    // Check valid entry ratio
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(l => {
        const trimmed = l.trim();
        return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//') && !trimmed.startsWith('!');
    }).length;

    if (nonEmptyLines > 0) {
        const validRatio = totalEntries / nonEmptyLines;
        if (validRatio < VALIDATION_CONFIG.minValidRatio) {
            return {
                valid: false,
                reason: `Low valid entry ratio: ${(validRatio * 100).toFixed(1)}% (minimum: ${VALIDATION_CONFIG.minValidRatio * 100}%)`
            };
        }
    }

    console.log(`[${sourceId}] ✓ Validation passed: ${totalEntries} entries`);
    return { valid: true };
}

/**
 * Downloads and parses a blocklist with retry and exponential backoff
 */
export async function fetchAndParseBlocklist(
    url: string,
    sourceId: string,
    onProgress?: (progress: DownloadProgress) => void
): Promise<{ domains: string[]; urls: string[] }> {
    const operationStart = Date.now();
    console.log(`[BlocklistUpdater] ========================================`);
    console.log(`[BlocklistUpdater] Starting blocklist update for: ${sourceId}`);
    console.log(`[BlocklistUpdater] Source URL: ${url}`);
    console.log(`[BlocklistUpdater] Max retries: ${RETRY_CONFIG.maxRetries}`);
    console.log(`[BlocklistUpdater] ========================================`);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = getRetryDelay(attempt - 1);
                console.log(`[${sourceId}] ⏳ Retry ${attempt}/${RETRY_CONFIG.maxRetries} - waiting ${delay}ms before retry...`);
                onProgress?.({
                    source: sourceId,
                    status: 'retrying',
                    retryCount: attempt,
                    nextRetryIn: delay
                });
                await sleep(delay);
            }

            // Download phase
            console.log(`[${sourceId}] PHASE 1: Downloading content... (attempt ${attempt + 1})`);
            onProgress?.({ source: sourceId, status: 'downloading' });

            const downloadStart = Date.now();
            const content = await downloadList(url);
            const downloadDuration = Date.now() - downloadStart;
            console.log(`[${sourceId}] ✓ Download phase completed in ${downloadDuration}ms`);
            console.log(`[${sourceId}] Content size: ${content.length.toLocaleString()} bytes (${(content.length / 1024 / 1024).toFixed(2)} MB)`);

            // Basic content validation
            if (content.length === 0) {
                throw new Error('Downloaded content is empty');
            }

            if (content.length < VALIDATION_CONFIG.minContentSize) {
                console.warn(`[${sourceId}] ⚠️ WARNING: Downloaded content is suspiciously small (${content.length} bytes)`);
                console.warn(`[${sourceId}] Content preview: ${content.substring(0, 500)}`);
            }

            // Parse phase
            console.log(`[${sourceId}] PHASE 2: Parsing content...`);
            onProgress?.({ source: sourceId, status: 'parsing' });

            const parseStart = Date.now();
            const result = await parseBlocklist(content, sourceId);
            const parseDuration = Date.now() - parseStart;
            console.log(`[${sourceId}] ✓ Parse phase completed in ${parseDuration}ms`);

            // Validation phase
            console.log(`[${sourceId}] PHASE 3: Validating results...`);
            const validation = validateBlocklistResult(result, content, sourceId);

            if (!validation.valid) {
                console.error(`[${sourceId}] ✗ Validation failed: ${validation.reason}`);
                console.error(`[${sourceId}] First 1000 chars of content:`);
                console.error(content.substring(0, 1000));
                throw new Error(`Validation failed: ${validation.reason}`);
            }

            // Results summary
            const totalDuration = Date.now() - operationStart;
            console.log(`[${sourceId}] ========================================`);
            console.log(`[${sourceId}] FINAL RESULTS:`);
            console.log(`[${sourceId}]   - Domains extracted: ${result.domains.length.toLocaleString()}`);
            console.log(`[${sourceId}]   - URLs extracted: ${result.urls.length.toLocaleString()}`);
            console.log(`[${sourceId}]   - Total entries: ${(result.domains.length + result.urls.length).toLocaleString()}`);
            console.log(`[${sourceId}]   - Total time: ${totalDuration}ms (download: ${downloadDuration}ms, parse: ${parseDuration}ms)`);
            if (attempt > 0) {
                console.log(`[${sourceId}]   - Successful after ${attempt} retries`);
            }
            console.log(`[${sourceId}] ========================================`);

            onProgress?.({
                source: sourceId,
                status: 'complete',
                domains: result.domains.length,
                urls: result.urls.length
            });

            console.log(`[${sourceId}] ✓ Blocklist update completed successfully`);
            return result;

        } catch (error: any) {
            lastError = error;
            const errorMessage = error.message || 'Unknown error';

            console.error(`[${sourceId}] ✗ Attempt ${attempt + 1} failed: ${errorMessage}`);

            // Check if error is retryable
            const isRetryable = isRetryableError(error);

            if (!isRetryable) {
                console.error(`[${sourceId}] Error is not retryable, giving up`);
                break;
            }

            if (attempt === RETRY_CONFIG.maxRetries) {
                console.error(`[${sourceId}] Max retries (${RETRY_CONFIG.maxRetries}) exceeded`);
            }
        }
    }

    // All retries exhausted
    const totalDuration = Date.now() - operationStart;
    const errorMessage = lastError?.message || 'Unknown error';

    console.error(`[${sourceId}] ========================================`);
    console.error(`[${sourceId}] ✗ BLOCKLIST UPDATE FAILED AFTER ALL RETRIES`);
    console.error(`[${sourceId}] Error: ${errorMessage}`);
    console.error(`[${sourceId}] Total attempts: ${RETRY_CONFIG.maxRetries + 1}`);
    console.error(`[${sourceId}] Time elapsed: ${totalDuration}ms`);
    console.error(`[${sourceId}] ========================================`);

    onProgress?.({
        source: sourceId,
        status: 'error',
        error: errorMessage
    });

    throw new Error(`Blocklist update failed for ${sourceId} after ${RETRY_CONFIG.maxRetries + 1} attempts: ${errorMessage}`);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
    const message = error.message || '';
    const code = error.code || '';

    // Network errors are retryable
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE', 'EAI_AGAIN'];
    if (retryableCodes.includes(code)) {
        return true;
    }

    // HTTP 5xx errors are retryable
    if (message.includes('HTTP 5')) {
        return true;
    }

    // Timeout errors are retryable
    if (message.includes('timeout') || message.includes('Timeout')) {
        return true;
    }

    // Empty content might be temporary
    if (message.includes('empty')) {
        return true;
    }

    // Validation failures are NOT retryable (format issue)
    if (message.includes('Validation failed')) {
        return false;
    }

    // HTTP 4xx errors are NOT retryable (client error)
    if (message.includes('HTTP 4')) {
        return false;
    }

    // Default: retry
    return true;
}
