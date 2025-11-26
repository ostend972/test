import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getStats: () => ipcRenderer.invoke('getStats'),
    getProxyStatus: () => ipcRenderer.invoke('getProxyStatus'),

    getBlocklistSources: () => ipcRenderer.invoke('getBlocklistSources'),
    toggleBlocklistSource: (id: string, enabled: boolean) => ipcRenderer.invoke('toggleBlocklistSource', id, enabled),
    addBlocklistSource: (name: string, url: string) => ipcRenderer.invoke('addBlocklistSource', name, url),
    removeBlocklistSource: (id: string) => ipcRenderer.invoke('removeBlocklistSource', id),
    updateBlocklists: () => ipcRenderer.invoke('updateBlocklists'),

    getWhitelistSources: () => ipcRenderer.invoke('getWhitelistSources'),
    toggleWhitelistSource: (id: string, enabled: boolean) => ipcRenderer.invoke('toggleWhitelistSource', id, enabled),
    addWhitelistSource: (name: string, url: string) => ipcRenderer.invoke('addWhitelistSource', name, url),
    removeWhitelistSource: (id: string) => ipcRenderer.invoke('removeWhitelistSource', id),

    getWhitelist: () => ipcRenderer.invoke('getWhitelist'),
    addToWhitelist: (domain: string) => ipcRenderer.invoke('addToWhitelist', domain),
    removeFromWhitelist: (domain: string) => ipcRenderer.invoke('removeFromWhitelist', domain),

    getBlocklist: () => ipcRenderer.invoke('getBlocklist'),
    addToBlocklist: (domain: string) => ipcRenderer.invoke('addToBlocklist', domain),
    removeFromBlocklist: (domain: string) => ipcRenderer.invoke('removeFromBlocklist', domain),

    getLogs: (filter: any) => ipcRenderer.invoke('getLogs', filter),

    getSystemLogs: () => ipcRenderer.invoke('getSystemLogs'),

    getSystemIntegrity: () => ipcRenderer.invoke('getSystemIntegrity'),
    repairSystemIntegrity: () => ipcRenderer.invoke('repairSystemIntegrity'),

    // DNS Manager
    applyDNS: (provider: 'system' | 'cloudflare' | 'google' | 'quad9') => ipcRenderer.invoke('applyDNS', provider),
    getDNSStatus: () => ipcRenderer.invoke('getDNSStatus'),

    startProxy: () => ipcRenderer.invoke('startProxy'),
    stopProxy: (duration?: number) => ipcRenderer.invoke('stopProxy', duration),
    onDomainEvent: (callback: any) => ipcRenderer.on('domain-event', (_event, value) => callback(value)),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('updateConfig', config),

    checkForUpdates: () => ipcRenderer.invoke('checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('installUpdate'),
    onUpdateAvailable: (callback: any) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
    onUpdateDownloadProgress: (callback: any) => ipcRenderer.on('update-download-progress', (_event, value) => callback(value)),
    onUpdateDownloaded: (callback: any) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
    onUpdateError: (callback: any) => ipcRenderer.on('update-error', (_event, value) => callback(value)),

    // Analytics
    getHourlyAnalytics: (hours?: number) => ipcRenderer.invoke('getHourlyAnalytics', hours),
    getDailyAnalytics: (days?: number) => ipcRenderer.invoke('getDailyAnalytics', days),
    getTopThreats: (limit?: number) => ipcRenderer.invoke('getTopThreats', limit),

    // Testing
    testBlock: (input: string, testType: 'domain' | 'url' | 'ip' | 'port') => ipcRenderer.invoke('testBlock', input, testType),
    quickAddWhitelist: (domain: string) => ipcRenderer.invoke('quickAddWhitelist', domain),
    quickAddBlocklist: (domain: string) => ipcRenderer.invoke('quickAddBlocklist', domain),

    // Conflict Detection
    detectListConflicts: () => ipcRenderer.invoke('detectListConflicts'),
    checkDomainConflict: (domain: string, targetList: 'whitelist' | 'blocklist') => ipcRenderer.invoke('checkDomainConflict', domain, targetList),

    // IPC Rate Limiter Stats
    getIPCRateLimiterStats: () => ipcRenderer.invoke('getIPCRateLimiterStats'),

    // Blocklist update progress
    onBlocklistUpdateProgress: (callback: any) => ipcRenderer.on('blocklist-update-progress', (_event, value) => callback(value)),
    onBlocklistUpdateComplete: (callback: any) => ipcRenderer.on('blocklist-update-complete', () => callback()),

    // Healthcheck
    runHealthCheck: () => ipcRenderer.invoke('runHealthCheck'),
    getQuickHealth: () => ipcRenderer.invoke('getQuickHealth'),

    // Proxy Bypass Detection
    detectBypassAttempts: () => ipcRenderer.invoke('detectBypassAttempts'),
    getProxySettingsStatus: () => ipcRenderer.invoke('getProxySettings'),
    getBypassDetectionStatus: () => ipcRenderer.invoke('getBypassDetectionStatus')
});
