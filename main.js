const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const backend = require('./backend');
const { validateIpc } = require('./backend/ipc-validator');
const UpdateManager = require('./backend/updater');

// Logging asynchrone pour diagnostiquer les problèmes
const logFile = path.join(app.getPath('userData'), 'calmweb-startup.log');
const logQueue = [];
let isWriting = false;

async function flushLogs() {
  if (isWriting || logQueue.length === 0) return;

  isWriting = true;
  const logsToWrite = [...logQueue];
  logQueue.length = 0;

  try {
    await fs.promises.appendFile(logFile, logsToWrite.join(''));
  } catch (e) {
    console.error('Erreur écriture log:', e);
  } finally {
    isWriting = false;

    // Si des logs ont été ajoutés pendant l'écriture, les écrire
    if (logQueue.length > 0) {
      setImmediate(flushLogs);
    }
  }
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);

  logQueue.push(logMessage);

  // Déclencher l'écriture de manière asynchrone
  setImmediate(flushLogs);
}

// Vider les logs à la fermeture de l'app
app.on('will-quit', async () => {
  if (logQueue.length > 0) {
    try {
      await fs.promises.appendFile(logFile, logQueue.join(''));
    } catch (e) {
      console.error('Erreur finale écriture log:', e);
    }
  }
});

log('=== DÉMARRAGE DE CALMWEB ===');
log(`Version Electron: ${process.versions.electron}`);
log(`Version Node: ${process.versions.node}`);
log(`Plateforme: ${process.platform}`);
log(`User Data: ${app.getPath('userData')}`);

let mainWindow = null;
let tray = null;
let eventInterval = null;
let configManager = null;
let securityEventHandler = null;
let statsUpdatedHandler = null;
let logHandler = null;
let updateManager = null;

/**
 * Helper pour obtenir le chemin de l'icône de manière robuste
 */
function getIconPath() {
  const iconPath = path.join(__dirname, 'icon.ico');
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  log(`Avertissement: Icône non trouvée à ${iconPath}`);
  return undefined;
}

/**
 * Crée la fenêtre principale
 * @param {boolean} minimized - Si true, lance en mode minimisé (barre des tâches uniquement)
 */
function createWindow(minimized = false) {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);
  console.log('__dirname:', __dirname);

  const iconPath = getIconPath();
  const windowOptions = {
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      cache: false,  // Désactiver le cache pour forcer le rechargement
    },
    title: 'CalmWeb Dashboard',
    fullscreen: false,  // Pas en plein écran par défaut
    maximizable: true,
    show: false  // Ne pas montrer immédiatement
  };

  if (iconPath) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Si pas minimisé, maximiser et afficher la fenêtre
  if (!minimized) {
    mainWindow.maximize();

    // Afficher la fenêtre une fois prête
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  } else {
    // Mode minimisé : ne pas afficher la fenêtre, juste la créer pour le tray
    log('Démarrage en mode minimisé (barre des tâches uniquement)');
  }

  // Charger le bon index.html selon le mode (dev vs production)
  let indexPath;
  if (app.isPackaged) {
    // Production: dist est extrait dans app.asar.unpacked
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
    const asarPath = path.join(__dirname, 'dist', 'index.html');

    // Vérifier quel chemin existe
    indexPath = fs.existsSync(unpackedPath) ? unpackedPath : asarPath;
  } else {
    // Dev: après build Vite
    indexPath = path.join(__dirname, 'dist', 'index.html');
  }

  log(`Chargement de: ${indexPath}`);
  log(`app.isPackaged: ${app.isPackaged}`);
  log(`__dirname: ${__dirname}`);
  log(`Fichier existe: ${fs.existsSync(indexPath)}`);

  mainWindow.loadFile(indexPath);

  // Ouvrir DevTools pour debugging (commenté pour production)
  // mainWindow.webContents.openDevTools();

  // Événements temps réel depuis le logger
  const managers = backend.getManagers();
  const logger = managers.logger;

  // Stocker les handlers pour pouvoir les nettoyer plus tard
  securityEventHandler = (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('domain_event', event);
    }
  };

  statsUpdatedHandler = (stats) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('stats_updated', stats);
    }
  };

  logHandler = (logEntry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('new_log', logEntry);
    }
  };

  // Écouter les événements de sécurité
  logger.on('security_event', securityEventHandler);

  // Écouter les mises à jour de stats
  logger.on('stats_updated', statsUpdatedHandler);

  // Écouter les nouveaux logs (temps réel)
  logger.on('log', logHandler);

  // Minimiser vers le tray au lieu de fermer
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  // Nettoyage à la fermeture
  mainWindow.on('closed', () => {
    // Nettoyer l'interval
    if (eventInterval) {
      clearInterval(eventInterval);
      eventInterval = null;
    }

    // Nettoyer les event listeners
    if (securityEventHandler) {
      logger.removeListener('security_event', securityEventHandler);
      securityEventHandler = null;
    }

    if (statsUpdatedHandler) {
      logger.removeListener('stats_updated', statsUpdatedHandler);
      statsUpdatedHandler = null;
    }

    mainWindow = null;
  });
}

/**
 * Crée l'icône dans la barre des tâches (system tray)
 */
async function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) {
    log('Impossible de créer le tray: icône manquante');
    return;
  }
  tray = new Tray(iconPath);

  // Récupérer la version depuis package.json
  const pkg = require('./package.json');
  const version = `v${pkg.version}`;

  // Récupérer le statut de protection
  let protectionStatus = 'Inconnue';
  try {
    const config = await configManager.get();
    protectionStatus = config.protectionEnabled ? 'Protection active' : 'Protection inactive';
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CalmWeb ${version}`,
      enabled: false
    },
    {
      label: protectionStatus,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Ouvrir CalmWeb',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CalmWeb - Protection web');
  tray.setContextMenu(contextMenu);

  // Double-clic pour afficher/masquer
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * Met à jour le menu contextuel du tray avec le statut actuel
 */
async function updateTrayMenu() {
  if (!tray) return;

  const pkg = require('./package.json');
  const version = `v${pkg.version}`;

  let protectionStatus = 'Inconnue';
  try {
    const config = await configManager.get();
    protectionStatus = config.protectionEnabled ? 'Protection active' : 'Protection inactive';
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CalmWeb ${version}`,
      enabled: false
    },
    {
      label: protectionStatus,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Ouvrir CalmWeb',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Initialisation de l'application
 */
app.whenReady().then(async () => {
  try {
    log('App ready - Initialisation de CalmWeb...');

    // Initialiser et démarrer le backend
    log('Initialisation du backend...');
    await backend.initialize();
    log('Backend initialisé');

    log('Démarrage du backend...');
    await backend.start();
    log('Backend démarré');

    console.log('Backend initialisé et démarré');

    // Récupérer les gestionnaires
    const managers = backend.getManagers();
    const { config, whitelist, blocklist, proxy, system, logger } = managers;

    // Rendre configManager accessible globalement pour updateTrayMenu
    configManager = config;

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Dashboard
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('getDashboardStats', async () => {
      try {
        const stats = logger.getStats();
        const proxyStatus = proxy.getStatus();

        return {
          blockedToday: stats.blockedToday,
          totalBlocked: stats.totalBlocked,
          lastThreat: stats.lastThreat,
          proxyStatus: proxyStatus.isRunning ? 'active' : 'inactive'
        };
      } catch (error) {
        logger.error(`Erreur getDashboardStats: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('getProxyStatus', async () => {
      try {
        const status = proxy.getStatus();
        return { status: status.isRunning ? 'active' : 'inactive' };
      } catch (error) {
        return { status: 'error' };
      }
    });

    ipcMain.handle('getChartData', async () => {
      try {
        // Générer des données de graphique basées sur les événements
        const now = new Date();
        const eventsResult = await logger.getSecurityEvents({ type: 'blocked' }, 1, 10000);
        const events = eventsResult.data || [];

        console.log('[getChartData] Événements bloqués:', events.length);

        // Créer 24 buckets pour les 24 dernières heures
        const buckets = Array.from({ length: 24 }, (_, i) => {
          const hour = new Date(now.getTime() - (23 - i) * 3600 * 1000);
          return {
            time: `${String(hour.getHours()).padStart(2, '0')}:00`,
            blocks: 0
          };
        });

        // Compter les événements par heure
        events.forEach(event => {
          const eventDate = new Date(event.timestamp);
          const hoursDiff = Math.floor((now - eventDate) / (1000 * 60 * 60));
          if (hoursDiff < 24) {
            const bucketIndex = 23 - hoursDiff;
            if (buckets[bucketIndex]) {
              buckets[bucketIndex].blocks++;
            }
          }
        });

        console.log('[getChartData] Données du graphique:', buckets);
        return buckets;
      } catch (error) {
        console.error('[getChartData] Erreur:', error.message, error.stack);
        logger.error(`Erreur getChartData: ${error.message}`);
        // Fallback
        return Array.from({ length: 24 }, (_, i) => ({
          time: `${String(i).padStart(2, '0')}:00`,
          blocks: 0
        }));
      }
    });

    ipcMain.handle('getTopBlockedCategories', async () => {
      try {
        return logger.getTopBlockedCategories();
      } catch (error) {
        return [];
      }
    });

    ipcMain.handle('getBlocklistMetadata', async () => {
      try {
        const { blocklist } = backend.getManagers();
        return blocklist.getMetadata();
      } catch (error) {
        logger.error(`Erreur getBlocklistMetadata: ${error.message}`);
        return {};
      }
    });

    ipcMain.handle('getThreatAnalysis', async () => {
      try {
        return logger.getThreatAnalysis();
      } catch (error) {
        return {
          title: "Analyse indisponible",
          summary: "Impossible de générer l'analyse pour le moment.",
          recommendation: ""
        };
      }
    });

    ipcMain.handle('getTopBlockedDomains', async () => {
      try {
        return logger.getTopBlockedDomains();
      } catch (error) {
        return [];
      }
    });

    ipcMain.handle('getProtectionStatusDetails', async () => {
      try {
        const cfg = config.get();
        const systemStatus = await system.getSystemStatus();

        return {
          layers: [
            {
              id: 'malware',
              name: 'Protection Arnaques & Malware',
              description: 'Blocage des sites malveillants, phishing, etc.',
              status: cfg.protectionEnabled ? 'active' : 'inactive'
            },
            {
              id: 'ads',
              name: 'Blocage Publicités',
              description: 'Basé sur les listes multiples',
              status: cfg.protectionEnabled ? 'active' : 'inactive'
            },
            {
              id: 'remote',
              name: 'Blocage Logiciels Distants',
              description: 'TeamViewer, AnyDesk, Assistance Windows',
              status: cfg.blockRemoteDesktop ? 'active' : 'inactive'
            },
            {
              id: 'ip_nav',
              name: 'Blocage Navigation par IP',
              description: 'Empêche les contournements par IP directe',
              status: cfg.blockDirectIPs ? 'active' : 'inactive'
            },
            {
              id: 'http',
              name: 'Force HTTPS',
              description: 'Bloque les connexions HTTP non sécurisées',
              status: cfg.blockHTTPTraffic ? 'active' : 'inactive'
            },
            {
              id: 'ports',
              name: 'Filtrage des Ports',
              description: 'Seuls les ports standards sont autorisés',
              status: cfg.blockNonStandardPorts ? 'active' : 'inactive'
            },
            {
              id: 'proxy',
              name: 'Proxy Système',
              description: 'Le trafic est routé via CalmWeb',
              status: systemStatus.proxy === 'configured' ? 'configured' : 'inactive'
            },
            {
              id: 'firewall',
              name: 'Règle Pare-feu',
              description: 'Assure le démarrage et la persistance',
              status: systemStatus.firewall === 'active' ? 'configured' : 'inactive'
            }
          ]
        };
      } catch (error) {
        logger.error(`Erreur getProtectionStatusDetails: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('getSystemIntegrityStatus', async () => {
      try {
        const status = await system.getSystemStatus();
        console.log('[getSystemIntegrityStatus] Status:', status);
        return status;
      } catch (error) {
        console.error('[getSystemIntegrityStatus] Error:', error.message);
        return {
          proxy: 'unknown',
          firewall: 'unknown',
          startupTask: 'unknown'
        };
      }
    });

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Whitelist
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('getWhitelist', async () => {
      try {
        return whitelist.getAll();
      } catch (error) {
        logger.error(`Erreur getWhitelist: ${error.message}`);
        return [];
      }
    });

    ipcMain.handle('addWhitelistDomain', validateIpc(
      { domain: 'domain' },
      async (event, { domain }) => {
        try {
          const result = await whitelist.add(domain);
          logger.info(`Domaine ajouté à la whitelist: ${domain}`);
          return result;
        } catch (error) {
          logger.error(`Erreur addWhitelistDomain: ${error.message}`);
          throw error;
        }
      }
    ));

    ipcMain.handle('deleteWhitelistDomain', validateIpc(
      { domainName: 'domain' },
      async (event, { domainName }) => {
        try {
          const result = await whitelist.remove(domainName);
          logger.info(`Domaine retiré de la whitelist: ${domainName}`);
          return result;
        } catch (error) {
          logger.error(`Erreur deleteWhitelistDomain: ${error.message}`);
          throw error;
        }
      }
    ));

    ipcMain.handle('exportWhitelist', async () => {
      try {
        return await whitelist.exportToCSV();
      } catch (error) {
        logger.error(`Erreur exportWhitelist: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('importWhitelist', validateIpc(
      { content: 'csvContent' },
      async (event, { content }) => {
        try {
          const result = await whitelist.importFromCSV(content);
          logger.info(`Whitelist importée: ${result.imported} domaines`);
          return result;
        } catch (error) {
          logger.error(`Erreur importWhitelist: ${error.message}`);
          throw error;
        }
      }
    ));

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Blocklist
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('getBlocklist', async () => {
      try {
        return blocklist.getCustomBlocklist();
      } catch (error) {
        logger.error(`Erreur getBlocklist: ${error.message}`);
        return [];
      }
    });

    ipcMain.handle('addBlocklistDomain', validateIpc(
      { domain: 'domain' },
      async (event, { domain }) => {
        try {
          const result = await blocklist.addCustomDomain(domain);
          logger.info(`Domaine ajouté à la blocklist: ${domain}`);
          return { id: Date.now(), domain, createdAt: new Date().toISOString(), ipAddress: 'N/A', hits: 0, lastUsed: null };
        } catch (error) {
          logger.error(`Erreur addBlocklistDomain: ${error.message}`);
          throw error;
        }
      }
    ));

    ipcMain.handle('deleteBlocklistDomain', validateIpc(
      { domainName: 'domain' },
      async (event, { domainName }) => {
        try {
          const result = await blocklist.removeCustomDomain(domainName);
          logger.info(`Domaine retiré de la blocklist: ${domainName}`);
          return result;
        } catch (error) {
          logger.error(`Erreur deleteBlocklistDomain: ${error.message}`);
          throw error;
        }
      }
    ));

    ipcMain.handle('exportBlocklist', async () => {
      try {
        return await blocklist.exportToCSV();
      } catch (error) {
        logger.error(`Erreur exportBlocklist: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('importBlocklist', validateIpc(
      { content: 'csvContent' },
      async (event, { content }) => {
        try {
          const result = await blocklist.importFromCSV(content);
          logger.info(`Blocklist importée: ${result.imported} domaines`);
          return result;
        } catch (error) {
          logger.error(`Erreur importBlocklist: ${error.message}`);
          throw error;
        }
      }
    ));

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Configuration
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('getConfig', async () => {
      try {
        return config.get();
      } catch (error) {
        logger.error(`Erreur getConfig: ${error.message}`);
        return config.getDefaultConfig();
      }
    });

    ipcMain.handle('updateConfig', validateIpc(
      { updates: 'config' },
      async (event, { updates }) => {
        try {
          const result = await config.update(updates);
          logger.info('Configuration mise à jour');

          // Si la protection est activée/désactivée, appliquer
          if (updates.protectionEnabled !== undefined) {
            await backend.setProtectionEnabled(updates.protectionEnabled);
            // Mettre à jour le menu du tray avec le nouveau statut
            await updateTrayMenu();
          }

          // Si blockRemoteDesktop a changé, recharger la blocklist
          if (updates.blockRemoteDesktop !== undefined) {
            const { blocklist } = backend.getManagers();
            await blocklist.reload();
            logger.info('Blocklist rechargée après changement de blockRemoteDesktop');
          }

          // Si enableUsefulDomains a changé et est activé, télécharger les useful domains
          if (updates.enableUsefulDomains === true && !result.usefulDomainsLoaded) {
            const { whitelist } = backend.getManagers();
            try {
              await whitelist.downloadUsefulDomains();
              await config.update({ usefulDomainsLoaded: true });
              logger.info('Useful Domains téléchargés suite à l\'activation');
            } catch (error) {
              logger.warn(`Erreur téléchargement useful domains: ${error.message}`);
            }
          }

          return result;
        } catch (error) {
          logger.error(`Erreur updateConfig: ${error.message}`);
          throw error;
        }
      }
    ));

    ipcMain.handle('disableProtection', async () => {
      try {
        await backend.setProtectionEnabled(false);
        logger.warn('Protection désactivée par l\'utilisateur');
        // Mettre à jour le menu du tray avec le nouveau statut
        await updateTrayMenu();
        return { message: 'Protection désactivée' };
      } catch (error) {
        logger.error(`Erreur disableProtection: ${error.message}`);
        throw error;
      }
    });

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Logs
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('getLogs', validateIpc(
      { filters: 'logFilters?', page: 'number?', pageSize: 'number?' },
      async (event, { filters, page, pageSize }) => {
        try {
          return await logger.getLogs(filters || {}, page || 1, pageSize || 50);
        } catch (error) {
          logger.error(`Erreur getLogs: ${error.message}`);
          return { data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } };
        }
      }
    ));

    ipcMain.handle('getSecurityEvents', validateIpc(
      { filters: 'logFilters?', page: 'number?', pageSize: 'number?' },
      async (event, { filters, page, pageSize }) => {
        try {
          return await logger.getSecurityEvents(filters || {}, page || 1, pageSize || 50);
        } catch (error) {
          logger.error(`Erreur getSecurityEvents: ${error.message}`);
          return { data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } };
        }
      }
    ));

    ipcMain.handle('exportLogs', async () => {
      try {
        const logsResult = await logger.getLogs({}, 1, 999999);
        const logs = logsResult.data || [];
        const content = logs.map(log =>
          `${log.timestamp} [${log.level}] ${log.message}`
        ).join('\n');

        return {
          content,
          filename: `calmweb_logs_${new Date().toISOString().split('T')[0]}.txt`
        };
      } catch (error) {
        logger.error(`Erreur exportLogs: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('generateDiagnosticReport', async () => {
      try {
        const cfg = config.get();
        const content = await logger.generateDiagnosticReport(cfg);

        return {
          content,
          filename: `calmweb_diagnostic_${new Date().toISOString().split('T')[0]}.txt`
        };
      } catch (error) {
        logger.error(`Erreur generateDiagnosticReport: ${error.message}`);
        throw error;
      }
    });

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Système
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('repairSystem', async () => {
      try {
        const result = await system.repairSystem();
        logger.info('Tentative de réparation système effectuée');
        return result;
      } catch (error) {
        logger.error(`Erreur repairSystem: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('installSystem', async () => {
      try {
        const result = await system.installSystem();
        logger.info('Installation système effectuée');
        return result;
      } catch (error) {
        logger.error(`Erreur installSystem: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('forceUpdateBlocklists', async () => {
      try {
        logger.info('Mise à jour forcée des blocklists demandée');
        await blocklist.forceUpdate();
        return { success: true, message: 'Blocklists mises à jour' };
      } catch (error) {
        logger.error(`Erreur forceUpdateBlocklists: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('forceReloadWhitelist', async () => {
      try {
        logger.info('Rechargement forcé de la whitelist GitHub demandé');
        const result = await whitelist.forceReloadWhitelist();
        return { success: true, message: `Whitelist rechargée: ${result.added} domaines`, added: result.added };
      } catch (error) {
        logger.error(`Erreur forceReloadWhitelist: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('forceReloadUsefulDomains', async () => {
      try {
        logger.info('Rechargement forcé des useful domains demandé');
        const result = await whitelist.forceReloadUsefulDomains();
        return { success: true, message: `Useful domains rechargés: ${result.added} domaines`, added: result.added };
      } catch (error) {
        logger.error(`Erreur forceReloadUsefulDomains: ${error.message}`);
        throw error;
      }
    });

    // ═══════════════════════════════════════════════════════
    // IPC HANDLERS - Mises à jour
    // ═══════════════════════════════════════════════════════

    ipcMain.handle('checkForUpdates', async () => {
      try {
        if (!updateManager) {
          throw new Error('UpdateManager non initialisé');
        }
        logger.info('Vérification manuelle des mises à jour');
        const result = await updateManager.checkForUpdates();
        return result;
      } catch (error) {
        logger.error(`Erreur checkForUpdates: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('downloadUpdate', async () => {
      try {
        if (!updateManager) {
          throw new Error('UpdateManager non initialisé');
        }
        logger.info('Téléchargement de la mise à jour');
        const result = await updateManager.downloadUpdate();
        return result;
      } catch (error) {
        logger.error(`Erreur downloadUpdate: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('installUpdate', async () => {
      try {
        if (!updateManager) {
          throw new Error('UpdateManager non initialisé');
        }
        logger.info('Installation de la mise à jour');
        updateManager.quitAndInstall();
        return { success: true };
      } catch (error) {
        logger.error(`Erreur installUpdate: ${error.message}`);
        throw error;
      }
    });

    ipcMain.handle('getUpdateInfo', async () => {
      try {
        if (!updateManager) {
          throw new Error('UpdateManager non initialisé');
        }
        const info = updateManager.getUpdateInfo();
        return info;
      } catch (error) {
        logger.error(`Erreur getUpdateInfo: ${error.message}`);
        throw error;
      }
    });

    // Créer l'icône dans la barre des tâches
    log('Création du tray...');
    await createTray();
    log('Tray créé');

    // Détecter si lancé en mode minimisé (pour l'installateur)
    const isMinimized = process.argv.includes('--minimized');

    // Créer la fenêtre
    log('Création de la fenêtre...');
    createWindow(isMinimized);
    log(isMinimized ? 'Fenêtre créée en mode minimisé' : 'Fenêtre créée');

    // Initialiser le gestionnaire de mises à jour
    log('Initialisation du gestionnaire de mises à jour...');
    updateManager = new UpdateManager(mainWindow);
    updateManager.enableAutoCheck(24); // Vérifier toutes les 24h
    log('✓ Gestionnaire de mises à jour prêt');

    log('Initialisation terminée avec succès');

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

  } catch (error) {
    log(`ERREUR FATALE: ${error.message}`);
    log(`Stack: ${error.stack}`);
    console.error('Erreur fatale lors de l\'initialisation:', error);

    // Afficher un message d'erreur à l'utilisateur
    dialog.showErrorBox('Erreur CalmWeb', `L'application n'a pas pu démarrer:\n\n${error.message}\n\nConsultez le fichier de log:\n${logFile}`);

    app.quit();
  }
});

/**
 * Nettoyage à la fermeture
 */
app.on('window-all-closed', function () {
  // Sur macOS, l'app reste active même sans fenêtre
  if (process.platform !== 'darwin') {
    // Sur Windows/Linux, quitter l'app (before-quit s'occupera du nettoyage)
    app.quit();
  }
});

/**
 * Gestion de l'arrêt propre - UN SEUL POINT D'ARRÊT
 */
let isQuitting = false;
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    try {
      log('Fermeture de l\'application...');
      // Arrêter le backend (désactive proxy et firewall)
      await backend.stop();
      log('Backend arrêté proprement');
    } catch (error) {
      console.error('Erreur arrêt avant quit:', error);
      log(`Erreur arrêt: ${error.message}`);
    } finally {
      // Quitter réellement
      isQuitting = false; // Réinitialiser pour permettre app.quit()
      setImmediate(() => app.quit());
    }
  }
});

/**
 * Gestion des événements de mise en veille / arrêt système
 */
app.whenReady().then(() => {
  // Désactiver le proxy lors de la mise en veille
  powerMonitor.on('suspend', async () => {
    try {
      log('Système en mise en veille - désactivation du proxy...');
      await backend.stop();
      log('✓ Proxy désactivé pour la mise en veille');
    } catch (error) {
      console.error('Erreur lors de la mise en veille:', error);
    }
  });

  // Réactiver le proxy au réveil
  powerMonitor.on('resume', async () => {
    try {
      log('Réveil du système - réactivation du proxy...');
      await backend.start();
      log('✓ Proxy réactivé après le réveil');
    } catch (error) {
      console.error('Erreur lors du réveil:', error);
    }
  });

  // Désactiver le proxy avant l'arrêt du système
  powerMonitor.on('shutdown', async (event) => {
    try {
      log('Arrêt du système - désactivation du proxy...');
      event.preventDefault(); // Empêcher l'arrêt immédiat

      // Timeout de 3 secondes max pour éviter de bloquer l'arrêt système
      const shutdownPromise = backend.stop();
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          log('⚠️ Timeout lors de l\'arrêt, forçage');
          resolve();
        }, 3000);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

      log('✓ Proxy désactivé pour l\'arrêt');
      app.quit();
    } catch (error) {
      console.error('Erreur lors de l\'arrêt:', error);
      app.quit();
    }
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Promesse rejetée non gérée:', error);
});
