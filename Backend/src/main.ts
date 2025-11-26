import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc';
import { startProxy, stopProxy, setStatusChangeCallback, isProxyRunning, setEventCallback } from './proxy';
import store from './store';
import { cleanupOldLogs } from './database';
import { logger, interceptConsole } from './logger';
import { disableProxySettings } from './system-integrity';
import { preloadPopularDomains, getDNSCacheStats } from './dns-cache';
import { getCoalescingStats } from './request-coalescing';
import { applyDNSProvider, restoreDNS, flushDNSCache } from './dns-manager';
import { initThreatIntelligence } from './threat-intelligence';

// Start logging system
interceptConsole();
logger.info('CalmWeb Backend starting...', { version: '1.0.0' });

// CRITICAL: Disable proxy settings and restore DNS on startup in case app crashed last time
// This prevents users from losing internet connection if CalmWeb didn't shut down cleanly
(async () => {
    try {
        await disableProxySettings();
        logger.info('Proxy settings cleaned on startup (preventing connection issues from previous crash)');

        // Restore DNS to system default in case app crashed with custom DNS
        await restoreDNS();
        logger.info('DNS restored to system default on startup');
    } catch (error: any) {
        logger.error('Failed to clean proxy/DNS on startup:', error.message);
    }
})();

// Preload DNS for popular domains (async, don't block startup)
setTimeout(() => {
    preloadPopularDomains().then(() => {
        const stats = getDNSCacheStats();
        logger.info('DNS cache preloaded', stats);
    });
}, 2000);

// Initialize Threat Intelligence (async, don't block startup)
setTimeout(() => {
    initThreatIntelligence().then(() => {
        logger.info('✓ Threat Intelligence initialized and running');
    }).catch((error) => {
        logger.error('Failed to initialize Threat Intelligence:', error.message);
    });
}, 3000); // 3 seconds after startup

// Run system healthcheck at startup
setTimeout(async () => {
    try {
        const { runHealthCheck } = await import('./healthcheck');
        const health = await runHealthCheck();
        logger.info(`System healthcheck completed: ${health.overall.toUpperCase()}`);

        if (health.overall === 'unhealthy') {
            logger.error('System healthcheck detected critical issues!');
        }
    } catch (error: any) {
        logger.error('Healthcheck failed:', error.message);
    }
}, 4000); // 4 seconds after startup

// Start proxy bypass detection
setTimeout(async () => {
    try {
        const { startBypassDetection, setBypassCallback } = await import('./proxy-bypass-detection');
        setBypassCallback((result) => {
            logger.warn(`[Security] Proxy bypass detected: ${result.method} - ${result.details}`);
        });
        startBypassDetection(30000); // Check every 30 seconds
        logger.info('✓ Proxy bypass detection started');
    } catch (error: any) {
        logger.error('Failed to start bypass detection:', error.message);
    }
}, 5000); // 5 seconds after startup

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Extend app with isQuitting flag
(app as any).isQuitting = false;

// Global tray menu update function
let updateTrayMenuGlobal: (() => void) | null = null;

// Notification throttle to avoid spam
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 10000; // 10 seconds

/**
 * Show desktop notification for blocked threats
 */
function showThreatNotification(domain: string) {
    const notificationsEnabled = (store as any).get('notifications');
    if (!notificationsEnabled) return;

    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) return; // Throttle

    lastNotificationTime = now;

    const notification = new Notification({
        title: 'CalmWeb - Threat Blocked',
        body: `Blocked malicious domain: ${domain}`,
        icon: app.isPackaged
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, '../../icon.ico'),
        silent: false
    });

    notification.show();
    logger.info('Notification shown for blocked domain:', domain);
}

function createTray() {
    // Create tray icon
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../../icon.ico');

    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    // Tray context menu
    const updateTrayMenu = () => {
        // Get REAL proxy status from the running server
        const proxyRunning = isProxyRunning();
        const version = '1.0.0';

        // Update tooltip based on actual status
        tray!.setToolTip(proxyRunning ? 'CalmWeb - Protection Active' : 'CalmWeb - Protection Inactive');

        const contextMenu = Menu.buildFromTemplate([
            {
                label: `CalmWeb v${version}`,
                enabled: false
            },
            { type: 'separator' },
            {
                label: proxyRunning ? '✓ Protection Active' : '✗ Protection Inactive',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Ouvrir',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    } else {
                        createWindow();
                    }
                }
            },
            {
                label: 'Quitter',
                click: () => {
                    app.quit();
                }
            }
        ]);

        tray!.setContextMenu(contextMenu);
    };

    // Make function globally accessible
    updateTrayMenuGlobal = updateTrayMenu;

    updateTrayMenu();

    // Left click to show window
    tray!.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.focus();
            } else {
                mainWindow.show();
            }
        } else {
            createWindow();
        }
    });

    // No longer needed - menu updates via callback when proxy status changes
    // setInterval(updateTrayMenu, 5000);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false, // Start hidden, will show after ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (app.isPackaged) {
        mainWindow.loadFile(path.join(process.resourcesPath, 'frontend_dist/index.html'));
    } else {
        mainWindow.loadURL('http://localhost:5173');
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        // Start minimized to tray on first launch
        if (!mainWindow) return;

        // Don't show window - stays in tray
        logger.info('Window ready - starting in tray');
    });

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            logger.info('Window hidden to tray');
        }
    });

    registerIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
    logger.info('Electron app ready');

    // Create tray icon first
    createTray();
    logger.info('Tray icon created');

    // Setup proxy status change callback to update tray
    setStatusChangeCallback((running: boolean) => {
        logger.info(`Proxy status changed: ${running ? 'Running' : 'Stopped'}`);
        if (updateTrayMenuGlobal) {
            updateTrayMenuGlobal();
        }
    });

    // Setup event callback for notifications
    setEventCallback((event) => {
        if (event.type === 'blocked') {
            showThreatNotification(event.domain);
        }
    });

    // Then create window (hidden)
    createWindow();

    // Clean up old logs on startup
    setTimeout(() => {
        logger.info('Starting log cleanup task...');
        const deleted = cleanupOldLogs();
        if (deleted > 0) {
            logger.info(`Cleaned up ${deleted} old logs`);
        }
    }, 5000); // Wait 5s after startup

    // Schedule daily cleanup (every 24 hours)
    setInterval(() => {
        logger.info('Running scheduled log cleanup...');
        const deleted = cleanupOldLogs();
        if (deleted > 0) {
            logger.info(`Cleaned up ${deleted} old logs`);
        }
    }, 24 * 60 * 60 * 1000);

    const autoStart = (store as any).get('autoStart');
    const proxyPort = (store as any).get('proxyPort');

    logger.info('Configuration loaded', {
        autoStart,
        proxyPort,
        sslInterception: (store as any).get('sslInterception'),
        blockNonStandardPorts: (store as any).get('blockNonStandardPorts'),
        blockNumericIPs: (store as any).get('blockNumericIPs'),
        forceHTTPS: (store as any).get('forceHTTPS')
    });

    // Silent system integrity check on startup
    logger.info('Checking system integrity...');
    (async () => {
        try {
            const { repairSystemIntegrity } = await import('./system-integrity');
            const exePath = process.execPath;
            await repairSystemIntegrity(exePath);
            logger.info('System integrity check completed');
        } catch (error: any) {
            logger.error('System integrity check failed:', error.message);
        }
    })();

    // ALWAYS start proxy protection on app launch
    logger.info(`Starting proxy protection on port ${proxyPort}...`);
    startProxy(proxyPort);

    // Enable Windows proxy settings for the protection to work
    (async () => {
        try {
            const { enableProxySettings } = await import('./system-integrity');
            await enableProxySettings();
            logger.info('✓ Windows proxy settings enabled');
            logger.info('✓ Protection activated automatically');
        } catch (error: any) {
            logger.error('Failed to enable Windows proxy settings:', error.message);
        }
    })();

    // Auto-download protection rules at startup and every 6 hours
    const downloadProtectionRules = async () => {
        logger.info('Updating protection rules...');
        try {
            const db = await import('./database');
            const { fetchAndParseBlocklist } = await import('./blocklist-updater');
            const blocklistSources = db.getBlocklistSources();
            const whitelistSources = db.getWhitelistSources();

            let totalDownloaded = 0;
            let successCount = 0;
            let failCount = 0;

            // Download enabled blocklists sequentially (one by one)
            const enabledBlocklists = blocklistSources.filter(s => s.enabled && s.url);
            logger.info(`Starting sequential download of ${enabledBlocklists.length} blocklists...`);
            for (let i = 0; i < enabledBlocklists.length; i++) {
                const source = enabledBlocklists[i];
                try {
                    logger.info(`[${i + 1}/${enabledBlocklists.length}] Downloading ${source.name}...`);
                    const result = await fetchAndParseBlocklist(source.url, source.id);
                    db.updateBlocklistEntries(source.id, result.domains, result.urls);
                    totalDownloaded += result.domains.length + result.urls.length;
                    successCount++;
                    logger.info(`✓ ${source.name}: ${result.domains.length + result.urls.length} entries downloaded`);

                    // Wait 500ms between each list to let UI breathe
                    if (i < enabledBlocklists.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error: any) {
                    failCount++;
                    logger.error(`✗ Failed to download ${source.name}:`, error.message);
                }
            }

            // Download enabled whitelists sequentially
            const enabledWhitelists = whitelistSources.filter(s => s.enabled && s.url);
            logger.info(`Starting sequential download of ${enabledWhitelists.length} whitelists...`);
            for (let i = 0; i < enabledWhitelists.length; i++) {
                const source = enabledWhitelists[i];
                try {
                    logger.info(`Downloading ${source.name}...`);
                    const result = await fetchAndParseBlocklist(source.url, source.id);
                    db.updateWhitelistDomains(source.id, result.domains);
                    logger.info(`✓ ${source.name}: ${result.domains.length} entries downloaded`);

                    // Wait 500ms between each list to let UI breathe
                    if (i < enabledWhitelists.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error: any) {
                    logger.error(`✗ Failed to download ${source.name}:`, error.message);
                }
            }

            logger.info(`🎉 Protection rules update completed! Success: ${successCount}, Failed: ${failCount}, Total entries: ${totalDownloaded}`);
        } catch (error: any) {
            logger.error('Failed to update protection rules:', error.message);
        }
    };

    // Check if this is the first run (no blocklist data)
    const isFirstRun = () => {
        const db = require('./database').default;
        const count = db.prepare("SELECT COUNT(*) as count FROM system_blocklist").get() as { count: number };
        return count.count === 0;
    };

    // Initial download - immediate on first run, 10s delay on subsequent runs
    if (isFirstRun()) {
        logger.info('🆕 First run detected - downloading protection rules immediately...');
        setTimeout(() => {
            downloadProtectionRules();
        }, 2000); // Just 2s delay to let UI load
    } else {
        setTimeout(() => {
            downloadProtectionRules();
        }, 10000); // 10s delay for subsequent runs
    }

    // Auto-update every 6 hours (6 * 60 * 60 * 1000 = 21600000 ms)
    setInterval(() => {
        logger.info('⏰ Scheduled update (every 6 hours) - updating protection rules...');
        downloadProtectionRules();
    }, 6 * 60 * 60 * 1000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            logger.info('App activated, creating window');
            createWindow();
        }
    });
});

// Cleanup before quit - CRITICAL for proper shutdown
app.on('before-quit', async (event) => {
    (app as any).isQuitting = true; // Set flag to allow window close
    logger.info('Application quitting - cleaning up...');

    // Prevent immediate quit to allow cleanup
    event.preventDefault();

    try {
        // Step 1: Stop the proxy server
        logger.info('Stopping proxy server...');
        stopProxy();

        // Step 2: Restore DNS to system default
        logger.info('Restoring DNS to system default...');
        await restoreDNS();

        // Step 3: Disable Windows proxy settings
        logger.info('Disabling Windows proxy settings...');
        await disableProxySettings();

        logger.info('Cleanup completed successfully');
    } catch (error: any) {
        logger.error('Cleanup error:', error.message);
    } finally {
        // Now allow the app to quit
        app.exit(0);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// CRITICAL: Emergency cleanup on unexpected crashes/errors
// This ensures proxy and DNS are restored even if app crashes
process.on('uncaughtException', async (error) => {
    logger.error('UNCAUGHT EXCEPTION:', error);
    try {
        await restoreDNS();
        await disableProxySettings();
        logger.info('Emergency DNS and proxy cleanup completed');
    } catch (cleanupError) {
        logger.error('Emergency cleanup failed:', cleanupError);
    }
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    logger.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
    try {
        await restoreDNS();
        await disableProxySettings();
        logger.info('Emergency DNS and proxy cleanup completed');
    } catch (cleanupError) {
        logger.error('Emergency cleanup failed:', cleanupError);
    }
    process.exit(1);
});
