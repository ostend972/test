/**
 * Proxy Bypass Detection Module
 * Detects attempts to bypass the proxy protection
 */

import { execSync, exec } from 'child_process';
import { logger } from './logger';

export interface BypassDetectionResult {
    bypassed: boolean;
    method?: string;
    details?: string;
    timestamp: string;
}

export interface ProxyIntegrityStatus {
    proxyEnabled: boolean;
    proxyServer: string | null;
    proxyExceptions: string[];
    lastCheck: string;
    issues: string[];
}

// Store last known good state
let lastKnownGoodState: ProxyIntegrityStatus | null = null;

// Callback for bypass detection
let onBypassDetected: ((result: BypassDetectionResult) => void) | null = null;

/**
 * Set callback for bypass detection events
 */
export function setBypassCallback(callback: (result: BypassDetectionResult) => void) {
    onBypassDetected = callback;
}

/**
 * Get current Windows proxy settings
 */
export async function getProxySettings(): Promise<ProxyIntegrityStatus> {
    const issues: string[] = [];
    let proxyEnabled = false;
    let proxyServer: string | null = null;
    let proxyExceptions: string[] = [];

    try {
        // Check ProxyEnable
        const enableResult = execSync(
            'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
            { encoding: 'utf8', timeout: 5000 }
        );
        proxyEnabled = enableResult.includes('0x1');

        // Check ProxyServer
        try {
            const serverResult = execSync(
                'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
                { encoding: 'utf8', timeout: 5000 }
            );
            const match = serverResult.match(/ProxyServer\s+REG_SZ\s+(.+)/);
            if (match) {
                proxyServer = match[1].trim();
            }
        } catch {
            // ProxyServer not set
        }

        // Check ProxyOverride (exceptions)
        try {
            const overrideResult = execSync(
                'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride',
                { encoding: 'utf8', timeout: 5000 }
            );
            const overrideMatch = overrideResult.match(/ProxyOverride\s+REG_SZ\s+(.+)/);
            if (overrideMatch) {
                proxyExceptions = overrideMatch[1].trim().split(';').filter(e => e.trim());
            }
        } catch {
            // ProxyOverride not set
        }

        // Validate settings
        if (!proxyEnabled) {
            issues.push('Proxy is disabled - protection may be bypassed');
        }

        if (proxyServer && !proxyServer.includes('127.0.0.1:8081')) {
            issues.push(`Proxy server changed to: ${proxyServer}`);
        }

        if (proxyExceptions.length > 0) {
            // Check for suspicious exceptions
            const suspiciousPatterns = ['*', '<local>', '*.com', '*.net', '*.org'];
            for (const exception of proxyExceptions) {
                if (suspiciousPatterns.some(p => exception.includes(p) && exception !== '<local>')) {
                    issues.push(`Suspicious proxy exception: ${exception}`);
                }
            }
        }

    } catch (error: any) {
        issues.push(`Failed to read proxy settings: ${error.message}`);
    }

    return {
        proxyEnabled,
        proxyServer,
        proxyExceptions,
        lastCheck: new Date().toISOString(),
        issues
    };
}

/**
 * Check for common bypass techniques
 */
export async function detectBypassAttempts(): Promise<BypassDetectionResult[]> {
    const results: BypassDetectionResult[] = [];
    const now = new Date().toISOString();

    // Check 1: Proxy settings changed
    const currentSettings = await getProxySettings();

    if (lastKnownGoodState) {
        if (lastKnownGoodState.proxyEnabled && !currentSettings.proxyEnabled) {
            results.push({
                bypassed: true,
                method: 'Proxy Disabled',
                details: 'Windows proxy was disabled',
                timestamp: now
            });
        }

        if (lastKnownGoodState.proxyServer !== currentSettings.proxyServer) {
            results.push({
                bypassed: true,
                method: 'Proxy Server Changed',
                details: `Changed from ${lastKnownGoodState.proxyServer} to ${currentSettings.proxyServer}`,
                timestamp: now
            });
        }

        // Check for new exceptions
        const newExceptions = currentSettings.proxyExceptions.filter(
            e => !lastKnownGoodState!.proxyExceptions.includes(e)
        );
        if (newExceptions.length > 0) {
            results.push({
                bypassed: true,
                method: 'New Proxy Exceptions',
                details: `Added exceptions: ${newExceptions.join(', ')}`,
                timestamp: now
            });
        }
    }

    // Check 2: VPN active (could bypass proxy)
    try {
        const netResult = execSync('netsh interface show interface', { encoding: 'utf8', timeout: 5000 });
        const lines = netResult.toLowerCase();

        // Common VPN interface names
        const vpnPatterns = ['vpn', 'tap', 'tun', 'wireguard', 'nordvpn', 'expressvpn', 'protonvpn'];

        for (const pattern of vpnPatterns) {
            if (lines.includes(pattern) && lines.includes('connected')) {
                results.push({
                    bypassed: true,
                    method: 'VPN Detected',
                    details: `VPN interface found: ${pattern}`,
                    timestamp: now
                });
                break;
            }
        }
    } catch {
        // Ignore errors
    }

    // Check 3: System-wide proxy bypass via environment variables
    try {
        const noProxy = process.env.NO_PROXY || process.env.no_proxy;
        const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;

        if (noProxy && noProxy.includes('*')) {
            results.push({
                bypassed: true,
                method: 'NO_PROXY Environment Variable',
                details: `NO_PROXY set to: ${noProxy}`,
                timestamp: now
            });
        }

        if (httpProxy && !httpProxy.includes('127.0.0.1:8081')) {
            results.push({
                bypassed: true,
                method: 'HTTP_PROXY Override',
                details: `HTTP_PROXY set to: ${httpProxy}`,
                timestamp: now
            });
        }
    } catch {
        // Ignore errors
    }

    // Update last known good state if no bypasses detected
    if (results.length === 0 && currentSettings.proxyEnabled) {
        lastKnownGoodState = currentSettings;
    }

    // Trigger callback for each bypass
    if (onBypassDetected) {
        for (const result of results) {
            onBypassDetected(result);
        }
    }

    return results;
}

/**
 * Start periodic bypass detection
 */
let detectionInterval: NodeJS.Timeout | null = null;

export function startBypassDetection(intervalMs: number = 30000) {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }

    logger.info(`[Bypass Detection] Starting periodic checks every ${intervalMs}ms`);

    // Initial check
    (async () => {
        const settings = await getProxySettings();
        if (settings.proxyEnabled) {
            lastKnownGoodState = settings;
            logger.info('[Bypass Detection] Initial state captured');
        }
    })();

    // Periodic checks
    detectionInterval = setInterval(async () => {
        try {
            const bypasses = await detectBypassAttempts();
            if (bypasses.length > 0) {
                logger.warn(`[Bypass Detection] ${bypasses.length} bypass attempt(s) detected!`);
                for (const bypass of bypasses) {
                    logger.warn(`[Bypass Detection] - ${bypass.method}: ${bypass.details}`);
                }
            }
        } catch (error: any) {
            logger.error('[Bypass Detection] Check failed:', error.message);
        }
    }, intervalMs);
}

/**
 * Stop periodic bypass detection
 */
export function stopBypassDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
        logger.info('[Bypass Detection] Stopped');
    }
}

/**
 * Get current bypass detection status
 */
export function getBypassDetectionStatus(): {
    running: boolean;
    lastKnownGoodState: ProxyIntegrityStatus | null;
} {
    return {
        running: detectionInterval !== null,
        lastKnownGoodState
    };
}
