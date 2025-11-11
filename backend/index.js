/**
 * Point d'entrée principal du backend CalmWeb
 * Orchestre tous les composants: proxy, blocklist, whitelist, config, system
 */

const configManager = require('./config-manager');
const WhitelistManager = require('./whitelist-manager');
const BlocklistManager = require('./blocklist-manager');
const ProxyServer = require('./proxy-server');
const SystemIntegration = require('./system-integration');
const logger = require('./logger');

class CalmWebBackend {
  constructor() {
    this.initialized = false;
    this.configManager = configManager;
    this.whitelistManager = null;
    this.blocklistManager = null;
    this.proxyServer = null;
    this.systemIntegration = null;
  }

  /**
   * Initialise tout le système
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Backend déjà initialisé');
      return;
    }

    try {
      logger.info('═══════════════════════════════════════════════════');
      logger.info('   Initialisation de CalmWeb Backend');
      logger.info('═══════════════════════════════════════════════════');

      // 1. Charger la configuration
      logger.info('Chargement de la configuration...');
      await this.configManager.load();
      logger.info('✓ Configuration chargée');

      // 2. Initialiser la whitelist
      logger.info('Initialisation de la whitelist...');
      this.whitelistManager = new WhitelistManager(this.configManager);
      await this.whitelistManager.initialize();
      logger.info('✓ Whitelist prête');

      // 3. Initialiser la blocklist
      logger.info('Initialisation de la blocklist...');
      this.blocklistManager = new BlocklistManager(this.configManager);
      await this.blocklistManager.initialize();
      logger.info('✓ Blocklist prête');

      // 4. Initialiser le serveur proxy
      logger.info('Initialisation du serveur proxy...');
      this.proxyServer = new ProxyServer(
        this.configManager,
        this.whitelistManager,
        this.blocklistManager
      );
      logger.info('✓ Serveur proxy prêt');

      // 4b. Configurer les callbacks pour fermer les connexions quand les listes changent
      const closeConnectionsCallback = () => {
        if (this.proxyServer) {
          this.proxyServer.closeAllConnections();
        }
      };
      this.whitelistManager.setOnListChanged(closeConnectionsCallback);
      this.blocklistManager.setOnListChanged(closeConnectionsCallback);
      logger.info('✓ Callbacks de rafraîchissement des connexions configurés');

      // 5. Initialiser l'intégration système
      logger.info('Initialisation de l\'intégration système...');
      this.systemIntegration = new SystemIntegration(this.configManager);
      logger.info('✓ Intégration système prête');

      this.initialized = true;

      logger.info('═══════════════════════════════════════════════════');
      logger.info('   CalmWeb Backend initialisé avec succès !');
      logger.info('═══════════════════════════════════════════════════');

      return true;
    } catch (error) {
      logger.error(`Erreur initialisation backend: ${error.message}`);
      throw error;
    }
  }

  /**
   * Démarre le proxy et configure le système
   */
  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const config = this.configManager.get();

      // Démarrer le proxy si la protection est activée
      if (config.protectionEnabled) {
        logger.info('Démarrage du serveur proxy...');
        await this.proxyServer.start();
        logger.info('✓ Serveur proxy démarré');

        // Configurer le proxy système
        logger.info('Configuration du proxy système...');
        await this.systemIntegration.setSystemProxy(
          true,
          config.proxyHost,
          config.proxyPort
        );
        logger.info('✓ Proxy système configuré');

        // Réactiver la règle firewall
        logger.info('Configuration de la règle firewall...');
        const exePath = process.execPath;
        await this.systemIntegration.addFirewallRule(exePath);
        logger.info('✓ Règle firewall configurée');
      }

      return true;
    } catch (error) {
      logger.error(`Erreur démarrage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Arrête le proxy et nettoie le système
   */
  async stop() {
    try {
      logger.info('Arrêt de CalmWeb...');

      // Désactiver le proxy système EN PREMIER pour éviter les problèmes de connexion
      if (this.systemIntegration) {
        await this.systemIntegration.setSystemProxy(false);
        logger.info('✓ Proxy système désactivé');
      }

      // Arrêter le proxy serveur
      if (this.proxyServer) {
        await this.proxyServer.stop();
        logger.info('✓ Serveur proxy arrêté');
      }

      // Nettoyer les ressources du blocklist manager
      if (this.blocklistManager) {
        this.blocklistManager.destroy();
        logger.info('✓ Ressources blocklist nettoyées');
      }

      logger.info('✓ CalmWeb arrêté proprement');
      return true;
    } catch (error) {
      logger.error(`Erreur arrêt: ${error.message}`);
      // Même en cas d'erreur, essayer de désactiver le proxy
      try {
        if (this.systemIntegration) {
          await this.systemIntegration.setSystemProxy(false);
          logger.info('✓ Proxy système désactivé (mode récupération)');
        }
      } catch (recoveryError) {
        logger.error(`Erreur récupération: ${recoveryError.message}`);
      }
      throw error;
    }
  }

  /**
   * Active/désactive la protection
   */
  async setProtectionEnabled(enabled) {
    try {
      await this.configManager.setProtectionEnabled(enabled);

      if (enabled) {
        await this.start();
      } else {
        await this.stop();
      }

      logger.info(`Protection ${enabled ? 'activée' : 'désactivée'}`);
      return true;
    } catch (error) {
      logger.error(`Erreur changement protection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtient le statut complet du système
   */
  async getFullStatus() {
    const proxyStatus = this.proxyServer ? this.proxyServer.getStatus() : { isRunning: false };
    const systemStatus = this.systemIntegration ? await this.systemIntegration.getSystemStatus() : {};
    const config = this.configManager.get();

    return {
      proxy: proxyStatus,
      system: systemStatus,
      protection: config.protectionEnabled,
      stats: logger.getStats()
    };
  }

  /**
   * Récupère tous les gestionnaires (pour Electron IPC)
   */
  getManagers() {
    return {
      config: this.configManager,
      whitelist: this.whitelistManager,
      blocklist: this.blocklistManager,
      proxy: this.proxyServer,
      system: this.systemIntegration,
      logger: logger
    };
  }
}

// Export singleton
const backend = new CalmWebBackend();

module.exports = backend;
