import { ipcMain, app } from 'electron';
import * as db from './database';
import store from './store';
import { startProxy, stopProxy, setEventCallback, isProxyRunning } from './proxy';
import { IElectronAPI, Config } from './types';
import { checkForUpdates, downloadUpdate, installUpdate, getCurrentVersion, initUpdater } from './updater';
import { applyDNSProvider, flushDNSCache, getDNSStatus } from './dns-manager';

export const registerIpcHandlers = (mainWindow: Electron.BrowserWindow) => {
    // Initialize updater with window
    initUpdater(mainWindow);

    // Helper to send events to renderer
    setEventCallback((event) => {
        mainWindow.webContents.send('domain-event', event);
    });

    ipcMain.handle('getStats', async () => {
        return db.getStats();
    });

    ipcMain.handle('getProxyStatus', async () => {
        const s = store as any;
        const running = isProxyRunning();

        return {
            status: running ? 'active' : 'inactive',
            port: s.get('proxyPort') || 8081,
            host: s.get('proxyHost') || '127.0.0.1'
        };
    });

    ipcMain.handle('getBlocklistSources', async () => db.getBlocklistSources());
    ipcMain.handle('toggleBlocklistSource', async (_, id, enabled) => db.toggleBlocklistSource(id, enabled));
    ipcMain.handle('addBlocklistSource', async (_, name, url) => db.addBlocklistSource({ id: Date.now().toString(), name, url, enabled: true, lastUpdate: new Date().toISOString(), domainCount: 0, category: 'Custom', custom: true }));
    ipcMain.handle('removeBlocklistSource', async (_, id) => db.removeBlocklistSource(id));

    ipcMain.handle('getWhitelistSources', async () => db.getWhitelistSources());
    ipcMain.handle('toggleWhitelistSource', async (_, id, enabled) => db.toggleWhitelistSource(id, enabled));
    ipcMain.handle('addWhitelistSource', async (_, name, url) => db.addWhitelistSource({ id: Date.now().toString(), name, url, enabled: true, lastUpdate: new Date().toISOString(), domainCount: 0, category: 'Custom', custom: true }));
    ipcMain.handle('removeWhitelistSource', async (_, id) => db.removeWhitelistSource(id));

    ipcMain.handle('getBlocklist', async () => db.getUserBlocklist());
    ipcMain.handle('addToBlocklist', async (_, domain) => db.addUserBlocklist(domain));
    ipcMain.handle('removeFromBlocklist', async (_, domain) => db.removeUserBlocklist(domain));

    ipcMain.handle('getWhitelist', async () => db.getUserWhitelist());
    ipcMain.handle('addToWhitelist', async (_, domain) => db.addUserWhitelist(domain));
    ipcMain.handle('removeFromWhitelist', async (_, domain) => db.removeUserWhitelist(domain));

    ipcMain.handle('getLogs', async (_, filter) => {
        return db.getLogs(filter?.limit || 50, filter?.offset || 0, filter?.type, filter?.search);
    });

    ipcMain.handle('getSystemLogs', async () => {
        const { getSystemLogs } = await import('./logger');
        return getSystemLogs();
    });

    ipcMain.handle('startProxy', async () => {
        const { logger } = await import('./logger');
        const { enableProxySettings } = await import('./system-integrity');
        const proxyPort = (store as any).get('proxyPort');
        const dnsProvider = (store as any).get('dnsProvider') || 'system';

        logger.info(`Starting proxy on port ${proxyPort}...`);

        // Apply DNS provider
        if (dnsProvider !== 'system') {
            logger.info(`Applying DNS provider: ${dnsProvider}...`);
            try {
                await applyDNSProvider(dnsProvider);
                await flushDNSCache(); // Vider le cache DNS Windows
                logger.info(`DNS provider ${dnsProvider} applied successfully`);
            } catch (error: any) {
                logger.error('Failed to apply DNS provider:', error.message);
            }
        }

        // Re-enable Windows proxy settings
        logger.info('Enabling Windows proxy settings...');
        try {
            await enableProxySettings();
            logger.info('Windows proxy enabled successfully');
        } catch (error: any) {
            logger.error('Failed to enable Windows proxy:', error.message);
        }

        startProxy(proxyPort);
        logger.info('Proxy started successfully');
    });

    // Timer for auto-resume
    let resumeTimer: NodeJS.Timeout | null = null;

    ipcMain.handle('stopProxy', async (_, duration?: number) => {
        const { logger } = await import('./logger');
        const { disableProxySettings } = await import('./system-integrity');
        const { restoreDNS } = await import('./dns-manager');

        // Clear any existing resume timer
        if (resumeTimer) {
            clearTimeout(resumeTimer);
            resumeTimer = null;
        }

        logger.info('Stopping proxy...', { duration: duration || 'manual' });
        stopProxy();

        // Restore DNS to system default
        logger.info('Restoring DNS to system default...');
        try {
            await restoreDNS();
            logger.info('DNS restored successfully');
        } catch (error: any) {
            logger.error('Failed to restore DNS:', error.message);
        }

        // Disable Windows proxy settings for instant UI feedback
        logger.info('Disabling Windows proxy settings...');
        try {
            await disableProxySettings();
            logger.info('Windows proxy disabled successfully');
        } catch (error: any) {
            logger.error('Failed to disable Windows proxy:', error.message);
        }

        logger.info('Proxy stopped');

        // If duration > 0, schedule auto-resume
        if (duration && duration > 0) {
            logger.info(`Proxy will auto-resume in ${duration}ms (${Math.round(duration / 60000)} minutes)`);
            resumeTimer = setTimeout(async () => {
                logger.info('Auto-resuming proxy...');
                const port = (store as any).get('proxyPort') || 8081;
                const { enableProxySettings } = await import('./system-integrity');

                // Re-enable Windows proxy
                try {
                    await enableProxySettings();
                    logger.info('Windows proxy re-enabled');
                } catch (error: any) {
                    logger.error('Failed to re-enable Windows proxy:', error.message);
                }

                startProxy(port);
                logger.info('Proxy auto-resumed');
                resumeTimer = null;
            }, duration);
        } else {
            logger.info('Proxy stopped until manual resume');
        }
    });

    ipcMain.handle('getConfig', async () => {
        return (store as any).store;
    });

    ipcMain.handle('updateConfig', async (_, newConfig) => {
        const { logger } = await import('./logger');

        // Update each config key individually to ensure proper reactivity
        for (const [key, value] of Object.entries(newConfig)) {
            (store as any).set(key, value);
        }

        // Handle auto-start task when autoStart changes
        if ('autoStart' in newConfig) {
            const { createAutoStartTask, deleteAutoStartTask } = await import('./system-integrity');
            const exePath = process.execPath;

            if (newConfig.autoStart) {
                logger.info('Auto-start enabled, creating scheduled task...');
                try {
                    await createAutoStartTask(exePath);
                    logger.info('Auto-start task created successfully');
                } catch (error: any) {
                    logger.error('Failed to create auto-start task:', error.message);
                }
            } else {
                logger.info('Auto-start disabled, deleting scheduled task...');
                try {
                    await deleteAutoStartTask();
                    logger.info('Auto-start task deleted successfully');
                } catch (error: any) {
                    logger.error('Failed to delete auto-start task:', error.message);
                }
            }
        }

        // Restart proxy if port changed
        if (newConfig.proxyPort) {
            stopProxy();
            startProxy(newConfig.proxyPort);
        }

        logger.info('[Config] Updated:', Object.keys(newConfig).join(', '));
    });

    ipcMain.handle('getSystemIntegrity', async () => {
        const { getSystemIntegrity: getSysIntegrity } = await import('./system-integrity');
        return await getSysIntegrity();
    });

    ipcMain.handle('repairSystemIntegrity', async () => {
        const { logger } = await import('./logger');
        const { repairSystemIntegrity: repairSysIntegrity } = await import('./system-integrity');
        const exePath = process.execPath;

        logger.info('System integrity repair requested');
        try {
            await repairSysIntegrity(exePath);
            logger.info('System integrity repair completed');
        } catch (error: any) {
            logger.error('System integrity repair failed:', error.message);
            throw error;
        }
    });

    // Threat Intelligence handlers
    ipcMain.handle('getThreatStats', async () => {
        const { getThreatStats } = await import('./threat-intelligence');
        return getThreatStats();
    });

    ipcMain.handle('getRecentThreats', async (_, limit = 100) => {
        const { getRecentThreats } = await import('./threat-intelligence');
        return getRecentThreats(limit);
    });

    ipcMain.handle('forceUpdateThreatIntel', async () => {
        const { logger } = await import('./logger');
        const { forceUpdate } = await import('./threat-intelligence');
        logger.info('Manual threat intelligence update requested');
        await forceUpdate();
    });

    // DNS Manager handlers
    ipcMain.handle('applyDNS', async (_, provider: 'system' | 'cloudflare' | 'google' | 'quad9') => {
        const { logger } = await import('./logger');

        logger.info(`Applying DNS provider: ${provider}`);
        try {
            await applyDNSProvider(provider);
            await flushDNSCache();
            logger.info(`DNS provider ${provider} applied successfully`);
            return { success: true };
        } catch (error: any) {
            logger.error(`Failed to apply DNS provider ${provider}:`, error.message);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('getDNSStatus', async () => {
        return await getDNSStatus();
    });

    // Rate Limiter handlers
    ipcMain.handle('getRateLimitStats', async () => {
        const { getRateLimitStats } = await import('./rate-limiter');
        return getRateLimitStats();
    });

    ipcMain.handle('getBlockedDomains', async () => {
        const { getBlockedDomains } = await import('./rate-limiter');
        return getBlockedDomains();
    });

    ipcMain.handle('resetRateLimit', async (_, domain: string) => {
        const { logger } = await import('./logger');
        const { resetRateLimit } = await import('./rate-limiter');
        logger.info(`Manual rate limit reset requested for: ${domain}`);
        resetRateLimit(domain);
    });

    // Update handlers
    ipcMain.handle('checkForUpdates', async () => {
        const { logger } = await import('./logger');
        logger.info('User requested update check');
        return await checkForUpdates();
    });

    ipcMain.handle('downloadUpdate', async () => {
        const { logger } = await import('./logger');
        logger.info('User started update download');
        await downloadUpdate();
    });

    ipcMain.handle('installUpdate', async () => {
        const { logger } = await import('./logger');
        logger.info('User requested update installation');

        try {
            installUpdate();
        } catch (error: any) {
            logger.error('Install update failed:', error.message);

            // If install fails (probably because not downloaded), download first
            if (error.message.includes('No valid update available')) {
                logger.info('Update not downloaded yet, initiating download...');
                const { downloadUpdate } = await import('./updater');
                await downloadUpdate();
                logger.info('Download initiated - update will install when complete');
            } else {
                throw error;
            }
        }
    });

    ipcMain.handle('getCurrentVersion', () => {
        return getCurrentVersion();
    });

    ipcMain.handle('getAppVersion', () => {
        return app.getVersion();
    });

    // Analytics endpoints
    ipcMain.handle('getHourlyAnalytics', async (_, hours = 13) => {
        return db.getHourlyAnalytics(hours);
    });

    ipcMain.handle('getDailyAnalytics', async (_, days = 7) => {
        return db.getDailyAnalytics(days);
    });

    ipcMain.handle('getTopThreats', async (_, limit = 5) => {
        return db.getTopThreats(limit);
    });

    ipcMain.handle('updateBlocklists', async () => {
        // Return immediately to not block the UI
        // The download will happen in the background

        // Launch background download (don't await)
        (async () => {
            try {
                const { fetchAndParseBlocklist } = await import('./blocklist-updater');
                const blocklistSources = db.getBlocklistSources();
                const whitelistSources = db.getWhitelistSources();

                const totalSources = blocklistSources.filter(s => s.enabled && s.url).length +
                                   whitelistSources.filter(s => s.enabled && s.url).length;
                let currentIndex = 0;

                // Update enabled blocklists sequentially
                for (const source of blocklistSources) {
                    if (source.enabled && source.url) {
                        currentIndex++;
                        try {
                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'downloading',
                                current: currentIndex,
                                total: totalSources
                            });

                            const result = await fetchAndParseBlocklist(source.url, source.id);
                            db.updateBlocklistEntries(source.id, result.domains, result.urls);

                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'complete',
                                current: currentIndex,
                                total: totalSources,
                                domains: result.domains.length + result.urls.length
                            });

                            // Wait 500ms between each list to let UI breathe
                            if (currentIndex < totalSources) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (error: any) {
                            console.error(`Failed to update ${source.name}:`, error);
                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'error',
                                current: currentIndex,
                                total: totalSources,
                                error: error.message
                            });
                        }
                    }
                }

                // Update enabled whitelists sequentially
                for (const source of whitelistSources) {
                    if (source.enabled && source.url) {
                        currentIndex++;
                        try {
                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'downloading',
                                current: currentIndex,
                                total: totalSources
                            });

                            const result = await fetchAndParseBlocklist(source.url, source.id);
                            db.updateWhitelistDomains(source.id, result.domains);

                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'complete',
                                current: currentIndex,
                                total: totalSources,
                                domains: result.domains.length
                            });

                            // Wait 500ms between each list to let UI breathe
                            if (currentIndex < totalSources) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } catch (error: any) {
                            console.error(`Failed to update ${source.name}:`, error);
                            mainWindow.webContents.send('blocklist-update-progress', {
                                source: source.name,
                                status: 'error',
                                current: currentIndex,
                                total: totalSources,
                                error: error.message
                            });
                        }
                    }
                }

                mainWindow.webContents.send('blocklist-update-complete');
            } catch (error: any) {
                console.error('Failed to update blocklists:', error);
                mainWindow.webContents.send('blocklist-update-complete');
            }
        })();

        // Return immediately
        return { success: true, downloading: true };
    });

    // Test blocking functionality
    ipcMain.handle('testBlock', async (_, input: string, testType: 'domain' | 'url' | 'ip' | 'port') => {
        const { logger } = await import('./logger');
        logger.info(`[Test] Testing ${testType}: ${input}`);

        try {
            let result: { blocked: boolean; reason?: string } = { blocked: false };

            switch (testType) {
                case 'domain': {
                    // Test if domain is blocked
                    const isBlocked = db.isDomainBlocked(input);
                    const isWhitelisted = db.isDomainWhitelisted(input);

                    if (isWhitelisted) {
                        result = { blocked: false, reason: 'Whitelisted' };
                    } else if (isBlocked) {
                        result = { blocked: true, reason: 'Domain in blocklist' };
                    } else {
                        result = { blocked: false, reason: 'Not in any list' };
                    }
                    break;
                }

                case 'url': {
                    // Test if URL is blocked
                    const isUrlBlocked = db.isUrlBlocked(input);

                    // Extract domain from URL
                    let domain = input;
                    try {
                        const urlObj = new URL(input.startsWith('http') ? input : `https://${input}`);
                        domain = urlObj.hostname;
                    } catch {}

                    const isDomainWhitelisted = db.isDomainWhitelisted(domain);
                    const isDomainBlocked = db.isDomainBlocked(domain);

                    if (isDomainWhitelisted) {
                        result = { blocked: false, reason: 'Domain whitelisted' };
                    } else if (isUrlBlocked) {
                        result = { blocked: true, reason: 'URL in blocklist' };
                    } else if (isDomainBlocked) {
                        result = { blocked: true, reason: 'Domain in blocklist' };
                    } else {
                        result = { blocked: false, reason: 'Not in any list' };
                    }
                    break;
                }

                case 'ip': {
                    // Test numeric IP blocking
                    const ipConfig = (store as any).get('blockNumericIPs') as boolean;
                    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

                    if (ipRegex.test(input)) {
                        if (ipConfig) {
                            result = { blocked: true, reason: 'Numeric IP blocked (policy enabled)' };
                        } else {
                            result = { blocked: false, reason: 'Numeric IP allowed (policy disabled)' };
                        }
                    } else {
                        result = { blocked: false, reason: 'Not a valid IP address' };
                    }
                    break;
                }

                case 'port': {
                    // Test non-standard port blocking
                    const portConfig = (store as any).get('blockNonStandardPorts') as boolean;
                    const port = parseInt(input);
                    const standardPorts = [80, 443, 8080, 8443];

                    if (isNaN(port) || port < 1 || port > 65535) {
                        result = { blocked: false, reason: 'Invalid port number' };
                    } else if (standardPorts.includes(port)) {
                        result = { blocked: false, reason: 'Standard port (always allowed)' };
                    } else if (portConfig) {
                        result = { blocked: true, reason: 'Non-standard port blocked (policy enabled)' };
                    } else {
                        result = { blocked: false, reason: 'Non-standard port allowed (policy disabled)' };
                    }
                    break;
                }
            }

            logger.info(`[Test] Result: ${result.blocked ? 'BLOCKED' : 'ALLOWED'} - ${result.reason}`);
            return result;
        } catch (error: any) {
            logger.error(`[Test] Error testing ${testType}:`, error.message);
            return { blocked: false, reason: `Error: ${error.message}` };
        }
    });

    // Quick add to whitelist
    ipcMain.handle('quickAddWhitelist', async (_, domain: string) => {
        try {
            db.addUserWhitelist(domain);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Quick add to blocklist
    ipcMain.handle('quickAddBlocklist', async (_, domain: string) => {
        try {
            db.addUserBlocklist(domain);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // Conflict detection handlers
    ipcMain.handle('detectListConflicts', async () => {
        return db.detectListConflicts();
    });

    ipcMain.handle('checkDomainConflict', async (_, domain: string, targetList: 'whitelist' | 'blocklist') => {
        return db.checkDomainConflict(domain, targetList);
    });

    // IPC Rate Limiter stats
    ipcMain.handle('getIPCRateLimiterStats', async () => {
        const { getRateLimiterStats } = await import('./ipc-rate-limiter');
        return getRateLimiterStats();
    });

    // Healthcheck handlers
    ipcMain.handle('runHealthCheck', async () => {
        const { runHealthCheck } = await import('./healthcheck');
        return await runHealthCheck();
    });

    ipcMain.handle('getQuickHealth', async () => {
        const { getQuickHealth } = await import('./healthcheck');
        return getQuickHealth();
    });

    // Proxy bypass detection handlers
    ipcMain.handle('detectBypassAttempts', async () => {
        const { detectBypassAttempts } = await import('./proxy-bypass-detection');
        return await detectBypassAttempts();
    });

    ipcMain.handle('getProxySettings', async () => {
        const { getProxySettings } = await import('./proxy-bypass-detection');
        return await getProxySettings();
    });

    ipcMain.handle('getBypassDetectionStatus', async () => {
        const { getBypassDetectionStatus } = await import('./proxy-bypass-detection');
        return getBypassDetectionStatus();
    });

    // Clear proxy cache (useful after whitelist/blocklist changes)
    ipcMain.handle('clearProxyCache', async () => {
        const { clearDomainCache } = await import('./proxy');
        clearDomainCache();
        return { success: true };
    });
};
