const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script Sécurisé
 * N'expose que les fonctionnalités strictement nécessaires avec validation
 */

// Limite le nombre d'appels API pour éviter le DoS
const rateLimiter = {
  calls: new Map(),
  limit: 999999, // Aucune limite pratique
  window: 60000, // par minute

  check(method) {
    const now = Date.now();
    const key = method;

    if (!this.calls.has(key)) {
      this.calls.set(key, []);
    }

    const callTimes = this.calls.get(key);

    // Nettoyer les appels anciens
    const recentCalls = callTimes.filter(time => now - time < this.window);

    if (recentCalls.length >= this.limit) {
      throw new Error(`Rate limit exceeded for ${method}`);
    }

    recentCalls.push(now);
    this.calls.set(key, recentCalls);
    return true;
  }
};

// Wrapper sécurisé pour les invocations IPC
function secureInvoke(channel, ...args) {
  try {
    rateLimiter.check(channel);
    return ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`[Preload Security] ${error.message}`);
    throw error;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ═══════════════════════════════════════════════════════
  // Real-time Events (avec nettoyage automatique)
  // ═══════════════════════════════════════════════════════

  onDomainEvent: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('domain_event', listener);
    return () => ipcRenderer.removeListener('domain_event', listener);
  },

  onStatsUpdated: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('stats_updated', listener);
    return () => ipcRenderer.removeListener('stats_updated', listener);
  },

  onNewLog: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('new_log', listener);
    return () => ipcRenderer.removeListener('new_log', listener);
  },

  // ═══════════════════════════════════════════════════════
  // Update Events (Real-time notifications)
  // ═══════════════════════════════════════════════════════

  onUpdateAvailable: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },

  onUpdateNotAvailable: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },

  onUpdateDownloadProgress: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },

  onUpdateDownloaded: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },

  onUpdateError: (callback) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const listener = (event, ...args) => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[Event Handler Error]', error);
      }
    };

    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },

  // ═══════════════════════════════════════════════════════
  // Lecture de Données (Non Sensibles)
  // ═══════════════════════════════════════════════════════

  getDashboardStats: () => secureInvoke('getDashboardStats'),
  getProxyStatus: () => secureInvoke('getProxyStatus'),
  getChartData: () => secureInvoke('getChartData'),
  getTopBlockedCategories: () => secureInvoke('getTopBlockedCategories'),
  getThreatAnalysis: () => secureInvoke('getThreatAnalysis'),
  getTopBlockedDomains: () => secureInvoke('getTopBlockedDomains'),
  getProtectionStatusDetails: () => secureInvoke('getProtectionStatusDetails'),
  getSystemIntegrityStatus: () => secureInvoke('getSystemIntegrityStatus'),

  // ═══════════════════════════════════════════════════════
  // Configuration (Lecture)
  // ═══════════════════════════════════════════════════════

  getConfig: () => secureInvoke('getConfig'),

  // ═══════════════════════════════════════════════════════
  // Whitelist & Blocklist (Lecture)
  // ═══════════════════════════════════════════════════════

  getWhitelist: () => secureInvoke('getWhitelist'),
  getBlocklist: () => secureInvoke('getBlocklist'),

  // ═══════════════════════════════════════════════════════
  // Logs (Lecture)
  // ═══════════════════════════════════════════════════════

  getLogs: (filters, page, pageSize) => secureInvoke('getLogs', { filters, page, pageSize }),
  getSecurityEvents: (filters, page, pageSize) => secureInvoke('getSecurityEvents', { filters, page, pageSize }),

  // ═══════════════════════════════════════════════════════
  // Actions de Modification (Validées côté main)
  // ═══════════════════════════════════════════════════════

  addWhitelistDomain: (domain) => {
    if (typeof domain !== 'string' || domain.length === 0 || domain.length > 253) {
      throw new Error('Invalid domain parameter');
    }
    return secureInvoke('addWhitelistDomain', domain);
  },

  deleteWhitelistDomain: (domainName) => {
    if (typeof domainName !== 'string' || domainName.length === 0) {
      throw new Error('Invalid domain parameter');
    }
    return secureInvoke('deleteWhitelistDomain', domainName);
  },

  addBlocklistDomain: (domain) => {
    if (typeof domain !== 'string' || domain.length === 0 || domain.length > 253) {
      throw new Error('Invalid domain parameter');
    }
    return secureInvoke('addBlocklistDomain', domain);
  },

  deleteBlocklistDomain: (domainName) => {
    if (typeof domainName !== 'string' || domainName.length === 0) {
      throw new Error('Invalid domain parameter');
    }
    return secureInvoke('deleteBlocklistDomain', domainName);
  },

  // ═══════════════════════════════════════════════════════
  // Configuration (Modification)
  // ═══════════════════════════════════════════════════════

  updateConfig: (config) => {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Config must be an object');
    }
    return secureInvoke('updateConfig', { updates: config });
  },

  // ═══════════════════════════════════════════════════════
  // Actions Sensibles (Nécessitent confirmation utilisateur)
  // ═══════════════════════════════════════════════════════

  disableProtection: async () => {
    // Confirmation requise côté UI avant cet appel
    console.warn('[Security] Protection being disabled');
    return secureInvoke('disableProtection');
  },

  repairSystem: async () => {
    // Confirmation requise côté UI avant cet appel
    console.warn('[Security] System repair requested');
    return secureInvoke('repairSystem');
  },

  forceBlocklistUpdate: async () => {
    console.info('[Security] Manual blocklist update requested');
    return secureInvoke('forceBlocklistUpdate');
  },

  // ═══════════════════════════════════════════════════════
  // Update Actions
  // ═══════════════════════════════════════════════════════

  checkForUpdates: () => secureInvoke('checkForUpdates'),
  downloadUpdate: () => secureInvoke('downloadUpdate'),
  installUpdate: () => secureInvoke('installUpdate'),
  getUpdateInfo: () => secureInvoke('getUpdateInfo'),

  // ═══════════════════════════════════════════════════════
  // Import/Export (Validés côté main)
  // ═══════════════════════════════════════════════════════

  exportLogs: () => secureInvoke('exportLogs'),
  generateDiagnosticReport: () => secureInvoke('generateDiagnosticReport'),
  exportWhitelist: () => secureInvoke('exportWhitelist'),
  exportBlocklist: () => secureInvoke('exportBlocklist'),

  importWhitelist: (fileData) => {
    if (typeof fileData !== 'object' || !fileData.content) {
      throw new Error('Invalid file data');
    }
    return secureInvoke('importWhitelist', fileData);
  },

  importBlocklist: (fileData) => {
    if (typeof fileData !== 'object' || !fileData.content) {
      throw new Error('Invalid file data');
    }
    return secureInvoke('importBlocklist', fileData);
  },
});
