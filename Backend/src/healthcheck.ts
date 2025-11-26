/**
 * System Healthcheck Module
 * Performs comprehensive system health verification at startup
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface HealthCheckResult {
    component: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
    details?: any;
}

export interface SystemHealth {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: HealthCheckResult[];
}

/**
 * Check if database file exists and is accessible
 */
async function checkDatabase(): Promise<HealthCheckResult> {
    try {
        const dbPath = path.join(app.getPath('userData'), 'calmweb.db');

        if (!fs.existsSync(dbPath)) {
            return {
                component: 'Database',
                status: 'warning',
                message: 'Database file not found - will be created on first run'
            };
        }

        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        return {
            component: 'Database',
            status: 'ok',
            message: `Database accessible (${sizeMB} MB)`,
            details: { size: stats.size, path: dbPath }
        };
    } catch (error: any) {
        return {
            component: 'Database',
            status: 'error',
            message: `Database check failed: ${error.message}`
        };
    }
}

/**
 * Check if user data directory is writable
 */
async function checkUserDataDirectory(): Promise<HealthCheckResult> {
    try {
        const userDataDir = app.getPath('userData');

        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        // Try to write a test file
        const testFile = path.join(userDataDir, '.healthcheck');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        return {
            component: 'UserData Directory',
            status: 'ok',
            message: 'Directory writable',
            details: { path: userDataDir }
        };
    } catch (error: any) {
        return {
            component: 'UserData Directory',
            status: 'error',
            message: `Directory not writable: ${error.message}`
        };
    }
}

/**
 * Check network connectivity
 */
async function checkNetworkConnectivity(): Promise<HealthCheckResult> {
    try {
        // Try to reach a known reliable endpoint
        const https = require('https');

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    component: 'Network',
                    status: 'warning',
                    message: 'Network check timed out - may have limited connectivity'
                });
            }, 5000);

            https.get('https://www.google.com/generate_204', (res: any) => {
                clearTimeout(timeout);
                if (res.statusCode === 204 || res.statusCode === 200) {
                    resolve({
                        component: 'Network',
                        status: 'ok',
                        message: 'Network connectivity OK'
                    });
                } else {
                    resolve({
                        component: 'Network',
                        status: 'warning',
                        message: `Unexpected response (HTTP ${res.statusCode})`
                    });
                }
            }).on('error', (err: any) => {
                clearTimeout(timeout);
                resolve({
                    component: 'Network',
                    status: 'warning',
                    message: `Network may be limited: ${err.message}`
                });
            });
        });
    } catch (error: any) {
        return {
            component: 'Network',
            status: 'warning',
            message: `Network check failed: ${error.message}`
        };
    }
}

/**
 * Check Windows proxy settings
 */
async function checkProxySettings(): Promise<HealthCheckResult> {
    try {
        // Check if proxy is currently enabled in Windows
        const result = execSync(
            'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
            { encoding: 'utf8', timeout: 5000 }
        );

        const isEnabled = result.includes('0x1');

        return {
            component: 'Proxy Settings',
            status: 'ok',
            message: isEnabled ? 'Windows proxy is enabled' : 'Windows proxy is disabled',
            details: { enabled: isEnabled }
        };
    } catch (error: any) {
        return {
            component: 'Proxy Settings',
            status: 'warning',
            message: `Could not check proxy settings: ${error.message}`
        };
    }
}

/**
 * Check available disk space
 */
async function checkDiskSpace(): Promise<HealthCheckResult> {
    try {
        const userDataDir = app.getPath('userData');
        const drive = userDataDir.charAt(0);

        // Use wmic to get disk space (works on Windows)
        const result = execSync(
            `wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace,Size /format:csv`,
            { encoding: 'utf8', timeout: 5000 }
        );

        const lines = result.trim().split('\n').filter(l => l.trim());
        if (lines.length >= 2) {
            const parts = lines[1].split(',');
            if (parts.length >= 3) {
                const freeSpace = parseInt(parts[1]) || 0;
                const totalSize = parseInt(parts[2]) || 1;
                const freeGB = freeSpace / (1024 * 1024 * 1024);
                const freePercent = ((freeSpace / totalSize) * 100).toFixed(1);

                if (freeGB < 1) {
                    return {
                        component: 'Disk Space',
                        status: 'error',
                        message: `Critical: Only ${freeGB.toFixed(2)} GB free (${freePercent}%)`,
                        details: { freeGB, freePercent }
                    };
                } else if (freeGB < 5) {
                    return {
                        component: 'Disk Space',
                        status: 'warning',
                        message: `Low disk space: ${freeGB.toFixed(2)} GB free (${freePercent}%)`,
                        details: { freeGB, freePercent }
                    };
                } else {
                    return {
                        component: 'Disk Space',
                        status: 'ok',
                        message: `${freeGB.toFixed(2)} GB free (${freePercent}%)`,
                        details: { freeGB, freePercent }
                    };
                }
            }
        }

        return {
            component: 'Disk Space',
            status: 'warning',
            message: 'Could not determine disk space'
        };
    } catch (error: any) {
        return {
            component: 'Disk Space',
            status: 'warning',
            message: `Disk space check failed: ${error.message}`
        };
    }
}

/**
 * Check system memory
 */
async function checkMemory(): Promise<HealthCheckResult> {
    try {
        const os = require('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedPercent = ((1 - (freeMem / totalMem)) * 100).toFixed(1);
        const freeGB = (freeMem / (1024 * 1024 * 1024)).toFixed(2);

        if (parseFloat(usedPercent) > 90) {
            return {
                component: 'Memory',
                status: 'warning',
                message: `High memory usage: ${usedPercent}% used (${freeGB} GB free)`,
                details: { usedPercent, freeGB }
            };
        }

        return {
            component: 'Memory',
            status: 'ok',
            message: `${usedPercent}% used (${freeGB} GB free)`,
            details: { usedPercent, freeGB }
        };
    } catch (error: any) {
        return {
            component: 'Memory',
            status: 'warning',
            message: `Memory check failed: ${error.message}`
        };
    }
}

/**
 * Check if port 8081 (default proxy port) is available
 */
async function checkPort(): Promise<HealthCheckResult> {
    return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();
        const port = 8081;

        server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                resolve({
                    component: 'Proxy Port',
                    status: 'warning',
                    message: `Port ${port} is already in use - may cause conflicts`,
                    details: { port, available: false }
                });
            } else {
                resolve({
                    component: 'Proxy Port',
                    status: 'warning',
                    message: `Port check error: ${err.message}`,
                    details: { port }
                });
            }
        });

        server.once('listening', () => {
            server.close();
            resolve({
                component: 'Proxy Port',
                status: 'ok',
                message: `Port ${port} is available`,
                details: { port, available: true }
            });
        });

        server.listen(port, '127.0.0.1');
    });
}

/**
 * Run all health checks
 */
export async function runHealthCheck(): Promise<SystemHealth> {
    console.log('[Healthcheck] Running system health checks...');
    const startTime = Date.now();

    const checks = await Promise.all([
        checkDatabase(),
        checkUserDataDirectory(),
        checkDiskSpace(),
        checkMemory(),
        checkPort(),
        checkProxySettings(),
        checkNetworkConnectivity()
    ]);

    // Determine overall health
    const hasError = checks.some(c => c.status === 'error');
    const hasWarning = checks.some(c => c.status === 'warning');

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (hasError) {
        overall = 'unhealthy';
    } else if (hasWarning) {
        overall = 'degraded';
    } else {
        overall = 'healthy';
    }

    const duration = Date.now() - startTime;
    console.log(`[Healthcheck] Completed in ${duration}ms - Status: ${overall.toUpperCase()}`);

    // Log any issues
    for (const check of checks) {
        const icon = check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠️' : '✗';
        console.log(`[Healthcheck] ${icon} ${check.component}: ${check.message}`);
    }

    return {
        overall,
        timestamp: new Date().toISOString(),
        checks
    };
}

/**
 * Quick health check for IPC endpoint
 */
export function getQuickHealth(): { status: string; uptime: number } {
    return {
        status: 'running',
        uptime: process.uptime()
    };
}
