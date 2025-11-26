import http from 'http';
import https from 'https';
import net from 'net';
import { URL } from 'url';
import { randomUUID } from 'crypto';
import { addLog, isDomainBlocked, isDomainWhitelisted, isUrlBlocked, updateHourlyStats, updateThreatStats } from './database';
import store from './store';
import { DomainEvent } from './types';
import { checkRateLimit } from './rate-limiter';
import { checkURLThreat } from './threat-intelligence';

// Callback to notify when proxy status changes
let statusChangeCallback: ((running: boolean) => void) | null = null;

let server: http.Server | null = null;
let eventCallbacks: Array<(event: DomainEvent) => void> = [];

// Domain cache for performance (5 minute TTL)
const domainCache = new Map<string, { blocked: boolean; reason?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10000; // Prevent unbounded growth

/**
 * Clear the entire domain cache
 * Called when whitelist/blocklist changes to ensure fresh lookups
 */
export const clearDomainCache = () => {
    const size = domainCache.size;
    domainCache.clear();
    console.log(`[Proxy] Domain cache cleared (${size} entries removed)`);
};

/**
 * Remove specific domain from cache
 */
export const invalidateDomainCache = (domain: string) => {
    let removed = 0;
    for (const key of domainCache.keys()) {
        if (key.includes(domain)) {
            domainCache.delete(key);
            removed++;
        }
    }
    if (removed > 0) {
        console.log(`[Proxy] Invalidated ${removed} cache entries for domain: ${domain}`);
    }
};

// Cleanup expired and excess cache entries
const cleanupCache = () => {
    const now = Date.now();

    // Remove expired entries
    for (const [key, value] of domainCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            domainCache.delete(key);
        }
    }

    // Enforce size limit (remove oldest if over limit)
    if (domainCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(domainCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, domainCache.size - MAX_CACHE_SIZE);
        toDelete.forEach(([key]) => domainCache.delete(key));
    }
};

// Run cleanup every minute
setInterval(cleanupCache, 60000);

/**
 * Generate beautiful blocked page HTML (neutral, no branding)
 */
const generateBlockedPage = (domain: string, reason: string): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.5s ease;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .shield {
            width: 80px;
            height: 80px;
            margin: 0 auto 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .shield-icon {
            font-size: 40px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
        }
        h1 {
            font-size: 32px;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 16px;
        }
        .domain {
            font-size: 18px;
            color: #4a5568;
            margin-bottom: 12px;
            font-family: 'Monaco', 'Courier New', monospace;
            background: #f7fafc;
            padding: 12px 20px;
            border-radius: 8px;
            word-break: break-all;
        }
        .reason {
            font-size: 16px;
            color: #718096;
            margin-bottom: 32px;
        }
        .info {
            font-size: 14px;
            color: #a0aec0;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="shield">
            <div class="shield-icon">\uD83D\uDEE1\uFE0F</div>
        </div>
        <h1>Access Denied</h1>
        <div class="domain">${domain}</div>
        <div class="reason">${reason}</div>
        <div class="info">
            This website has been blocked by your security policy.
            <br>If you believe this is an error, please contact your administrator.
        </div>
    </div>
</body>
</html>`;
};

// Benign errors that should not be logged (normal network behavior)
const BENIGN_ERRORS = [
    'ECONNRESET',     // Connection reset by peer (normal)
    'ECONNABORTED',   // Connection aborted
    'EPIPE',          // Broken pipe
    'ETIMEDOUT',      // Timeout (already logged separately)
    'ENOTFOUND',      // DNS not found (already logged)
    'ECANCELED',      // Request canceled
    'socket hang up', // Socket hang up (client disconnect)
    'ECONNREFUSED',   // Connection refused (server down)
];

/**
 * Check if an error is benign and should be silently ignored
 */
function isBenignError(error: Error): boolean {
    return BENIGN_ERRORS.some(benign =>
        error.message.includes(benign) || error.name === benign
    );
}

/**
 * Parse HTTP headers from request lines
 */
function parseHeaders(headerLines: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
        if (!line || line === '') break;
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            headers[key] = value;
        }
    }
    return headers;
}

/**
 * Check if domain is a numeric IP address
 */
function isNumericIP(domain: string): boolean {
    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Regex.test(domain) || ipv6Regex.test(domain);
}

/**
 * Check if port is non-standard (not 80 or 443)
 */
function isNonStandardPort(port: number): boolean {
    return port !== 80 && port !== 443;
}

/**
 * Check security policies before blocklist checks
 * Returns { blocked: true, reason: string } if blocked by policy
 */
function checkSecurityPolicies(domain: string, port: number, protocol: string): { blocked: boolean; reason?: string } {
    const config = (store as any).store;

    // Policy 1: Block Numeric IPs
    if (config.blockNumericIPs && isNumericIP(domain)) {
        return { blocked: true, reason: 'Numeric IP Blocked (Security Policy)' };
    }

    // Policy 2: Block Non-Standard Ports
    if (config.blockNonStandardPorts && isNonStandardPort(port)) {
        return { blocked: true, reason: `Non-Standard Port ${port} Blocked (Security Policy)` };
    }

    // Policy 3: Block HTTP (Force HTTPS)
    if (config.forceHTTPS && protocol === 'http') {
        return { blocked: true, reason: 'HTTP Blocked (Security Policy - HTTPS Required)' };
    }

    return { blocked: false };
}

// Retry configuration
interface RetryConfig {
    maxRetries: number;
    initialTimeout: number;
    maxTimeout: number;
}

const RETRY_CONFIG: RetryConfig = {
    maxRetries: 0,          // No retry for HTTPS (CONNECT is different from HTTP)
    initialTimeout: 60000,  // 60s timeout (increased from 30s for slow connections)
    maxTimeout: 90000       // 90s for retry if needed
};

const isBlocked = (fullUrl: string, domain: string, port: number = 80, protocol: string = 'http'): { blocked: boolean; reason?: string } => {
    // Check cache first (use full URL as cache key)
    const cached = domainCache.get(fullUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return { blocked: cached.blocked, reason: cached.reason };
    }

    // 0. Check Whitelist FIRST - bypasses ALL blocking (security policies, blocklists, etc.)
    if (isDomainWhitelisted(domain)) {
        const result = { blocked: false, reason: 'Whitelisted' };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // 1. Check Rate Limit (prevent DDoS/flood attacks)
    const rateCheck = checkRateLimit(domain);
    if (rateCheck.limited) {
        const result = { blocked: true, reason: rateCheck.reason };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // 2. Check Threat Intelligence (real-time threat detection)
    // ONLY block exact malicious URLs, NOT entire domains
    // This prevents false positives on services like Discord, Google Drive, GitHub
    const urlThreat = checkURLThreat(fullUrl);
    if (urlThreat.threat) {
        const threatType = urlThreat.details?.type || 'unknown';
        const result = {
            blocked: true,
            reason: `Threat Intelligence: ${threatType} URL (${urlThreat.details?.source || 'unknown'})`
        };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // 3. Check Security Policies (IP, ports, HTTP blocking)
    const policyCheck = checkSecurityPolicies(domain, port, protocol);

    if (policyCheck.blocked) {
        const result = { blocked: true, reason: policyCheck.reason };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // 4. Check exact URL match (high priority for malware/phishing)
    if (isUrlBlocked(fullUrl)) {
        const result = { blocked: true, reason: 'Malicious URL' };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // 5. Check domain blocklist (fallback)
    if (isDomainBlocked(domain)) {
        const result = { blocked: true, reason: 'Blocked Domain' };
        domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
        return result;
    }

    // Not blocked
    const result = { blocked: false };
    domainCache.set(fullUrl, { ...result, timestamp: Date.now() });
    return result;
};

export const startProxy = (port: number) => {
    if (server) {
        console.log(`[Proxy] Server already running on port ${port}, skipping start`);
        return;
    }

    console.log(`[Proxy] Starting HTTP/HTTPS proxy server on port ${port}...`);

    server = http.createServer((req, res) => {
        const startTime = Date.now(); // Start measuring latency
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const domain = url.hostname;
        const fullUrl = `http://${domain}${url.pathname}${url.search}`;
        const timestamp = new Date().toISOString();
        const portNum = parseInt(url.port) || 80;

        const check = isBlocked(fullUrl, domain, portNum, 'http');

        if (check.blocked) {
            res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(generateBlockedPage(domain, check.reason || 'Blocked Domain'));

            // Track analytics
            updateHourlyStats('blocked');
            updateThreatStats(domain);

            addLog({
                id: randomUUID(),
                timestamp,
                type: 'blocked',
                domain: `${domain}${url.pathname}`,
                reason: check.reason,
                method: req.method || 'GET',
                duration: Date.now() - startTime
            });

            emitEvent({ type: 'blocked', domain, timestamp, reason: check.reason });
            return;
        }

        // Forward request with retry logic
        let retryCount = 0;
        const makeRequest = (timeoutDuration: number) => {
            const cleanHeaders: any = { ...req.headers };

            // Remove proxy-specific headers
            delete cleanHeaders['proxy-connection'];
            delete cleanHeaders['proxy-authorization'];

            // Update Host header with actual destination
            cleanHeaders['host'] = portNum !== 80 ? `${domain}:${portNum}` : domain;

            // Enable keep-alive for better performance
            cleanHeaders['connection'] = 'keep-alive';

            const options = {
                hostname: domain,
                port: portNum,
                path: url.pathname + url.search,
                method: req.method,
                headers: cleanHeaders
            };

            const proxyReq = http.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                proxyRes.pipe(res, { end: true });

                // Log when response is complete
                proxyRes.on('end', () => {
                    addLog({
                        id: randomUUID(),
                        timestamp,
                        type: 'allowed',
                        domain,
                        reason: retryCount > 0 ? `Allowed (retry ${retryCount})` : 'Allowed',
                        method: req.method || 'GET',
                        duration: Date.now() - startTime
                    });

                    // Track analytics
                    updateHourlyStats('allowed');

                    emitEvent({ type: 'allowed', domain, timestamp });
                });
            });

            // Set progressive timeout
            proxyReq.setTimeout(timeoutDuration, () => {
                console.log(`[Proxy] Request timeout for ${domain} after ${timeoutDuration / 1000}s (attempt ${retryCount + 1})`);
                proxyReq.destroy();

                // Retry if we haven't exceeded max retries
                if (retryCount < RETRY_CONFIG.maxRetries && !res.headersSent) {
                    retryCount++;
                    console.log(`[Proxy] Retrying ${domain} with ${RETRY_CONFIG.maxTimeout / 1000}s timeout...`);
                    makeRequest(RETRY_CONFIG.maxTimeout);
                    return;
                }

                if (!res.headersSent) {
                    res.writeHead(504, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Gateway Timeout - CalmWeb</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #ff9800; margin: 0 0 20px 0; }
        .error-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }
        .details { color: #666; font-size: 14px; margin-top: 10px; }
        .actions { margin-top: 25px; }
        a { color: #2196f3; text-decoration: none; padding: 10px 20px; background: #e3f2fd; border-radius: 4px; display: inline-block; }
        a:hover { background: #bbdefb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⏱️ Request Timeout (504)</h1>
        <div class="error-box">
            <strong>The server took too long to respond</strong>
            <div class="details">
                <p>CalmWeb proxy was unable to get a response from <strong>${domain}</strong> within 30 seconds.</p>
                <p>This could mean the server is slow, overloaded, or temporarily unavailable.</p>
            </div>
        </div>
        <div class="actions">
            <p><strong>What you can do:</strong></p>
            <ul>
                <li><a href="javascript:location.reload()">🔄 Retry Now</a></li>
                <li>Wait a few moments and try again</li>
                <li>Check if the website is accessible from other networks</li>
            </ul>
        </div>
    </div>
</body>
</html>`);
            }
        });

            // Handle client disconnect (silent - normal behavior)
            req.on('close', () => {
                if (!res.headersSent) {
                    proxyReq.destroy();
                }
            });

            // Handle client errors
            req.on('error', (err) => {
                console.error(`[Proxy] Client request error for ${domain}:`, err.message);
                proxyReq.destroy();
            });

            req.pipe(proxyReq, { end: true });

            proxyReq.on('error', (err) => {
                // Only log non-benign errors
                if (!isBenignError(err)) {
                    console.error(`[Proxy] Request Error for ${domain}:`, err.message);
                }

                // Retry on network errors if we haven't exceeded max retries
                if (retryCount < RETRY_CONFIG.maxRetries && !res.headersSent &&
                    (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET'))) {
                    retryCount++;
                    console.log(`[Proxy] Retrying ${domain} after error (attempt ${retryCount + 1})...`);
                    makeRequest(RETRY_CONFIG.maxTimeout);
                    return;
                }

            // Only send error if headers not already sent
            if (!res.headersSent) {
                // Determine appropriate error code and message
                let statusCode = 502; // Bad Gateway (default)
                let errorTitle = 'Connection Error';
                let errorMessage = 'Unable to connect to the destination server';

                if (err.message.includes('ENOTFOUND')) {
                    statusCode = 502;
                    errorTitle = 'DNS Lookup Failed';
                    errorMessage = 'The domain name could not be resolved';
                } else if (err.message.includes('ECONNREFUSED')) {
                    statusCode = 502;
                    errorTitle = 'Connection Refused';
                    errorMessage = 'The server refused the connection';
                } else if (err.message.includes('ETIMEDOUT')) {
                    statusCode = 504;
                    errorTitle = 'Connection Timeout';
                    errorMessage = 'The connection timed out';
                } else if (err.message.includes('ECONNRESET')) {
                    statusCode = 502;
                    errorTitle = 'Connection Reset';
                    errorMessage = 'The server closed the connection unexpectedly';
                }

                res.writeHead(statusCode, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Proxy-Error': 'true'
                });

                res.end(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${errorTitle} - CalmWeb</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #e74c3c; margin: 0 0 20px 0; }
        .error-box { background: #ffebee; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; }
        .details { color: #666; font-size: 14px; margin-top: 10px; }
        .tech-details { background: #f5f5f5; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 12px; border-radius: 4px; }
        .actions { margin-top: 25px; }
        a { color: #2196f3; text-decoration: none; padding: 10px 20px; background: #e3f2fd; border-radius: 4px; display: inline-block; margin-right: 10px; }
        a:hover { background: #bbdefb; }
        ul { line-height: 1.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚫 ${errorTitle} (${statusCode})</h1>
        <div class="error-box">
            <strong>${errorMessage}</strong>
            <div class="details">
                <p>CalmWeb proxy was unable to connect to <strong>${domain}</strong></p>
                <div class="tech-details">
                    Technical details: ${err.message}
                </div>
            </div>
        </div>
        <div class="actions">
            <p><strong>Possible solutions:</strong></p>
            <ul>
                <li>Check your internet connection</li>
                <li>Verify the website URL is correct</li>
                <li>The website may be temporarily down</li>
                <li>Try again in a few moments</li>
            </ul>
            <a href="javascript:location.reload()">🔄 Retry</a>
            <a href="http://${domain}" target="_blank">🔗 Try Direct Access</a>
        </div>
    </div>
</body>
</html>`);
            }

            // Only log non-benign errors to the journal
            // Benign errors (socket hang up, ECONNRESET, etc.) are normal and shouldn't pollute the log
            if (!isBenignError(err)) {
                addLog({
                    id: randomUUID(),
                    timestamp,
                    type: 'allowed',
                    domain,
                    reason: `Connection Error: ${err.message}`,
                    method: req.method || 'GET',
                    duration: Date.now() - startTime
                });
            }
            });
        };

        // Start with initial timeout
        makeRequest(RETRY_CONFIG.initialTimeout);
    });

    server.on('connect', (req, clientSocket, head) => {
        const startTime = Date.now(); // Start measuring latency
        const { port, hostname } = new URL(`http://${req.url}`);
        const domain = hostname;
        const timestamp = new Date().toISOString();

        // Simple HTTPS passthrough (no SSL interception)
        const fullUrl = `https://${domain}/`;
        const portNum = Number(port) || 443;
        const check = isBlocked(fullUrl, domain, portNum, 'https');

        if (check.blocked) {
            clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            clientSocket.end();
            updateHourlyStats('blocked');
            updateThreatStats(domain);
            addLog({
                id: randomUUID(),
                timestamp,
                type: 'blocked',
                domain,
                reason: check.reason,
                method: 'CONNECT',
                duration: Date.now() - startTime
            });
            emitEvent({ type: 'blocked', domain, timestamp, reason: check.reason });
            return;
        }

        // CONNECT with retry logic
        let connectRetryCount = 0;
        const makeConnect = (timeoutDuration: number) => {
            const serverSocket = net.connect(Number(port) || 443, domain, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                    'Proxy-agent: CalmWeb-Proxy\r\n' +
                    '\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);

                // Log when connection is established
                addLog({
                    id: randomUUID(),
                    timestamp,
                    type: 'allowed',
                    domain,
                    reason: connectRetryCount > 0 ? `Allowed (retry ${connectRetryCount})` : 'Allowed',
                    method: 'CONNECT',
                    duration: Date.now() - startTime
                });

                updateHourlyStats('allowed');
                emitEvent({ type: 'allowed', domain, timestamp });
            });

            // Set progressive timeout for CONNECT (silent on first attempt, log on retries)
            serverSocket.setTimeout(timeoutDuration, () => {
                // Only log on retry attempts (not first timeout - too noisy)
                if (connectRetryCount > 0) {
                    console.log(`[Proxy] CONNECT timeout for ${domain} after ${timeoutDuration / 1000}s (attempt ${connectRetryCount + 1})`);
                }
                serverSocket.destroy();

                // Retry if we haven't exceeded max retries
                if (connectRetryCount < RETRY_CONFIG.maxRetries) {
                    connectRetryCount++;
                    console.log(`[Proxy] Retrying CONNECT to ${domain} with ${RETRY_CONFIG.maxTimeout / 1000}s timeout...`);
                    makeConnect(RETRY_CONFIG.maxTimeout);
                    return;
                }

                clientSocket.end('HTTP/1.1 504 Gateway Timeout\r\n\r\n');
            });

            serverSocket.on('error', (err) => {
                // Only log non-benign errors
                if (!isBenignError(err)) {
                    console.error(`[Proxy] CONNECT Error for ${domain}:`, err.message);
                }

                // Retry on network errors if we haven't exceeded max retries
                if (connectRetryCount < RETRY_CONFIG.maxRetries &&
                    (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET'))) {
                    connectRetryCount++;
                    console.log(`[Proxy] Retrying CONNECT to ${domain} after error (attempt ${connectRetryCount + 1})...`);
                    makeConnect(RETRY_CONFIG.maxTimeout);
                    return;
                }

                // Send appropriate error response
                let errorResponse = 'HTTP/1.1 502 Bad Gateway\r\n\r\n';

                if (err.message.includes('ENOTFOUND')) {
                    errorResponse = 'HTTP/1.1 502 Bad Gateway\r\nX-Error: DNS-Failed\r\n\r\n';
                } else if (err.message.includes('ECONNREFUSED')) {
                    errorResponse = 'HTTP/1.1 502 Bad Gateway\r\nX-Error: Connection-Refused\r\n\r\n';
                } else if (err.message.includes('ETIMEDOUT')) {
                    errorResponse = 'HTTP/1.1 504 Gateway Timeout\r\nX-Error: Timeout\r\n\r\n';
                }

                clientSocket.end(errorResponse);

                // Only log non-benign errors to the journal
                // Benign errors (socket hang up, ECONNRESET, etc.) are normal and shouldn't pollute the log
                if (!isBenignError(err)) {
                    addLog({
                        id: randomUUID(),
                        timestamp,
                        type: 'allowed',
                        domain,
                        reason: `CONNECT Error: ${err.message}`,
                        method: 'CONNECT',
                        duration: Date.now() - startTime
                    });
                }
            });

            // Handle client disconnect
            clientSocket.on('error', (err) => {
                // Only log non-benign client errors
                if (!isBenignError(err)) {
                    console.error(`[Proxy] Client socket error for ${domain}:`, err.message);
                }
                serverSocket.destroy();
            });
        };

        // Start with initial timeout
        makeConnect(RETRY_CONFIG.initialTimeout);
    });

    server.listen(port, () => {
        console.log(`[Proxy] ✓ HTTP/HTTPS proxy server successfully started on port ${port}`);
        console.log(`[Proxy] Listening for HTTP and HTTPS (CONNECT) requests`);

        // Update store state
        (store as any).set('proxyRunning', true);
        (store as any).set('proxyPort', port);

        // Notify status change
        if (statusChangeCallback) {
            statusChangeCallback(true);
        }
    });

    server.on('error', (error: any) => {
        console.error(`[Proxy] ✗ Server error:`, error.message);
        if (error.code === 'EADDRINUSE') {
            console.error(`[Proxy] ✗ Port ${port} is already in use by another application`);
        } else if (error.code === 'EACCES') {
            console.error(`[Proxy] ✗ Permission denied to bind to port ${port}`);
        }
    });
};

export const stopProxy = () => {
    if (server) {
        console.log('[Proxy] Stopping proxy server...');
        server.close(() => {
            console.log('[Proxy] ✓ Proxy server stopped successfully');

            // Update store state
            (store as any).set('proxyRunning', false);

            // Notify status change
            if (statusChangeCallback) {
                statusChangeCallback(false);
            }
        });
        server = null;
    } else {
        console.log('[Proxy] No server running, nothing to stop');

        // Ensure store is updated even if server wasn't running
        (store as any).set('proxyRunning', false);

        // Notify status change
        if (statusChangeCallback) {
            statusChangeCallback(false);
        }
    }
};

export const setEventCallback = (cb: (event: DomainEvent) => void) => {
    eventCallbacks.push(cb);
};

// Helper to emit events to all callbacks
const emitEvent = (event: DomainEvent) => {
    eventCallbacks.forEach(cb => cb(event));
};

export const setStatusChangeCallback = (cb: (running: boolean) => void) => {
    statusChangeCallback = cb;
};

export const isProxyRunning = (): boolean => {
    return server !== null;
};
