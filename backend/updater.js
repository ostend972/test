/**
 * ═══════════════════════════════════════════════════════════════════
 * GESTIONNAIRE DE MISES À JOUR AUTOMATIQUES - CALMWEB
 * ═══════════════════════════════════════════════════════════════════
 *
 * Utilise electron-updater pour télécharger et installer des mises à jour
 * différentielles (via blockmap) depuis GitHub Releases
 */

const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const logger = require('./logger');

class UpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.updateInfo = null;
    this.updateCheckInterval = null; // Stocker l'ID de l'interval
    this.startupTimeout = null; // Stocker l'ID du timeout initial

    this.setupAutoUpdater();
  }

  /**
   * Configure electron-updater
   */
  setupAutoUpdater() {
    // Configuration
    autoUpdater.autoDownload = false; // Ne pas télécharger automatiquement
    autoUpdater.autoInstallOnAppQuit = true; // Installer à la fermeture

    // Logs
    autoUpdater.logger = {
      info: (message) => logger.info(`[AutoUpdater] ${message}`),
      warn: (message) => logger.warn(`[AutoUpdater] ${message}`),
      error: (message) => logger.error(`[AutoUpdater] ${message}`),
      debug: (message) => logger.debug(`[AutoUpdater] ${message}`)
    };

    // ═══════════════════════════════════════════════════════════════
    // ÉVÉNEMENTS
    // ═══════════════════════════════════════════════════════════════

    // Vérification de mise à jour disponible
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.updateInfo = info;

      logger.info(`Mise à jour disponible: v${info.version}`);
      logger.info(`Taille: ${(info.files[0].size / 1024 / 1024).toFixed(2)} MB`);

      // Notifier le renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-available', {
          version: info.version,
          releaseDate: info.releaseDate,
          size: info.files[0].size,
          releaseName: info.releaseName,
          releaseNotes: info.releaseNotes
        });
      }

      // Afficher une notification
      this.showUpdateNotification(info);
    });

    // Pas de mise à jour disponible
    autoUpdater.on('update-not-available', (info) => {
      logger.info('Application à jour');

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-not-available');
      }
    });

    // Progression du téléchargement
    autoUpdater.on('download-progress', (progressObj) => {
      const message = {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      };

      logger.info(`Téléchargement: ${progressObj.percent.toFixed(2)}%`);

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-download-progress', message);
      }
    });

    // Mise à jour téléchargée
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Mise à jour téléchargée, prête à installer');

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-downloaded', {
          version: info.version
        });
      }

      // Demander si on installe maintenant
      this.showInstallPrompt(info);
    });

    // Erreur
    autoUpdater.on('error', (error) => {
      logger.error(`Erreur mise à jour: ${error.message}`);

      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-error', {
          message: error.message
        });
      }
    });
  }

  /**
   * Vérifie s'il y a des mises à jour
   */
  async checkForUpdates() {
    try {
      logger.info('Vérification des mises à jour...');
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      logger.error(`Erreur vérification mise à jour: ${error.message}`);
      return null;
    }
  }

  /**
   * Télécharge la mise à jour
   */
  async downloadUpdate() {
    try {
      if (!this.updateAvailable) {
        logger.warn('Aucune mise à jour disponible à télécharger');
        return false;
      }

      logger.info('Début du téléchargement de la mise à jour...');
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      logger.error(`Erreur téléchargement: ${error.message}`);
      return false;
    }
  }

  /**
   * Installe la mise à jour et redémarre
   */
  quitAndInstall() {
    logger.info('Installation de la mise à jour...');
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Affiche une notification de mise à jour disponible
   */
  showUpdateNotification(info) {
    const size = (info.files[0].size / 1024 / 1024).toFixed(2);

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `CalmWeb ${info.version} est disponible !`,
      detail: `Version actuelle: ${require('../package.json').version}\n` +
              `Nouvelle version: ${info.version}\n` +
              `Taille du téléchargement: ~${size} MB\n\n` +
              `Grâce au système de mise à jour différentielle, vous ne téléchargerez que les parties modifiées de l'application.`,
      buttons: ['Télécharger maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        this.downloadUpdate();
      }
    });
  }

  /**
   * Demande si on installe la mise à jour maintenant
   */
  showInstallPrompt(info) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      title: 'Mise à jour prête',
      message: `CalmWeb ${info.version} est prêt à être installé`,
      detail: 'L\'installation prendra quelques secondes.\n' +
              'L\'application redémarrera automatiquement.',
      buttons: ['Installer maintenant', 'Installer à la fermeture'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        this.quitAndInstall();
      }
      // Sinon, s'installera automatiquement à la fermeture
    });
  }

  /**
   * Obtient les informations de la mise à jour disponible
   */
  getUpdateInfo() {
    return this.updateInfo;
  }

  /**
   * Active la vérification automatique au démarrage
   */
  enableAutoCheck(intervalHours = 24) {
    // Nettoyer les intervals/timeouts existants pour éviter les doublons
    this.disableAutoCheck();

    // Vérifier au démarrage (après 10 secondes)
    this.startupTimeout = setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Vérifier périodiquement
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalHours * 60 * 60 * 1000);

    logger.info(`Vérification automatique activée (toutes les ${intervalHours}h)`);
  }

  /**
   * Désactive la vérification automatique
   */
  disableAutoCheck() {
    // Nettoyer le timeout de démarrage
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }

    // Nettoyer l'interval périodique
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.info('Vérification automatique désactivée');
    }
  }
}

module.exports = UpdateManager;
