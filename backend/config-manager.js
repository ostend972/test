const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { validateFilePathForRead, validateFilePathForWrite } = require('./path-validator');

/**
 * Gestionnaire de configuration pour CalmWeb
 * Stocke la configuration dans %APPDATA%\CalmWeb\config.json
 */
class ConfigManager {
  constructor() {
    this.config = null;
    this.configPath = this.getConfigPath();
    this.configDir = path.dirname(this.configPath);
  }

  /**
   * Détermine le chemin du fichier de configuration
   */
  getConfigPath() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const configDir = path.join(appData, 'CalmWeb');
    return path.join(configDir, 'config.json');
  }

  /**
   * Configuration par défaut
   */
  getDefaultConfig() {
    return {
      // Protection générale
      protectionEnabled: true,

      // Règles de sécurité
      blockDirectIPs: true,
      blockHTTPTraffic: true,
      blockNonStandardPorts: true,
      blockRemoteDesktop: true,

      // Proxy
      proxyPort: 8081,
      proxyHost: '127.0.0.1',

      // Sources de blocklists
      blocklistSources: {
        urlhaus: true,           // URLhaus (abuse.ch)
        stevenBlack: true,        // StevenBlack/hosts
        hageziUltimate: true,     // HaGeZi Ultimate
        phishingArmy: true,       // Phishing Army
        easylistFR: true          // Liste FR
      },

      // URLs des sources
      blocklistURLs: {
        urlhaus: 'https://urlhaus.abuse.ch/downloads/hostfile/',
        stevenBlack: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
        hageziUltimate: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/ultimate.txt',
        phishingArmy: 'https://phishing.army/download/phishing_army_blocklist.txt',
        easylistFR: 'https://raw.githubusercontent.com/easylist/listefr/master/hosts.txt'
      },

      // Whitelist GitHub
      whitelistGitHubURL: 'https://raw.githubusercontent.com/Tontonjo/calmweb/main/filters/whitelist.txt',
      usefulDomainsURL: 'https://raw.githubusercontent.com/Tontonjo/calmweb/main/filters/usefull_domains.txt',
      enableUsefulDomains: false, // Pour utilisateurs avancés

      // Mise à jour
      updateInterval: 24, // heures
      lastUpdate: null,

      // Installation
      installed: false,
      installPath: 'C:\\Program Files\\CalmWeb',

      // Métadonnées
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Crée le dossier de configuration s'il n'existe pas
   */
  async ensureConfigDirExists() {
    try {
      await fs.access(this.configDir);
    } catch (error) {
      // Le dossier n'existe pas, le créer
      await fs.mkdir(this.configDir, { recursive: true });
    }
  }

  /**
   * Charge la configuration depuis le fichier
   */
  async load() {
    try {
      await this.ensureConfigDirExists();

      try {
        const content = await fs.readFile(this.configPath, 'utf-8');
        this.config = JSON.parse(content);

        // Merger avec les valeurs par défaut pour ajouter les nouvelles clés
        this.config = { ...this.getDefaultConfig(), ...this.config };
      } catch (error) {
        // Fichier n'existe pas, vérifier si c'est la première installation
        this.config = this.getDefaultConfig();

        // Chercher la config initiale de l'installateur
        const initialConfigPath = path.join(this.configDir, 'initial-config.json');
        try {
          const initialContent = await fs.readFile(initialConfigPath, 'utf-8');
          const initialConfig = JSON.parse(initialContent);

          // Appliquer la config de l'installateur
          if (initialConfig.proxyPort) {
            this.config.proxyPort = parseInt(initialConfig.proxyPort, 10);
          }
          if (initialConfig.protectionEnabled !== undefined) {
            this.config.protectionEnabled = initialConfig.protectionEnabled;
          }

          console.log('[ConfigManager] Configuration initiale appliquée depuis l\'installateur');

          // Supprimer le fichier initial-config.json après l'avoir lu
          await fs.unlink(initialConfigPath);
        } catch (initialError) {
          // Pas de config initiale, utiliser les valeurs par défaut
        }

        await this.save();
      }

      return this.config;
    } catch (error) {
      console.error('Erreur chargement configuration:', error);
      // Fallback sur config par défaut
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * Sauvegarde la configuration
   */
  async save() {
    try {
      await this.ensureConfigDirExists();

      // Mettre à jour le timestamp
      this.config.updatedAt = new Date().toISOString();

      const content = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, content, 'utf-8');

      return true;
    } catch (error) {
      console.error('Erreur sauvegarde configuration:', error);
      throw error;
    }
  }

  /**
   * Récupère la configuration actuelle
   */
  get() {
    if (!this.config) {
      throw new Error('Configuration non chargée. Appelez load() d\'abord.');
    }
    return { ...this.config };
  }

  /**
   * Valide une valeur de configuration
   */
  validateConfigValue(key, value) {
    if (key === 'proxyPort') {
      if (typeof value !== 'number' || value < 1024 || value > 65535) {
        throw new Error('Port invalide. Doit être entre 1024 et 65535.');
      }
    }
    if (key === 'updateInterval') {
      if (typeof value !== 'number' || value < 1) {
        throw new Error('Intervalle invalide. Doit être >= 1 heure.');
      }
    }
  }

  /**
   * Met à jour la configuration (merge partiel)
   */
  async update(updates) {
    if (!this.config) {
      await this.load();
    }

    // Valider les mises à jour
    for (const [key, value] of Object.entries(updates)) {
      this.validateConfigValue(key, value);
    }

    // Merge des updates
    this.config = { ...this.config, ...updates };

    await this.save();
    return this.get();
  }

  /**
   * Met à jour une valeur spécifique
   */
  async set(key, value) {
    if (!this.config) {
      await this.load();
    }

    // Valider la valeur
    this.validateConfigValue(key, value);

    this.config[key] = value;
    await this.save();
    return this.get();
  }

  /**
   * Récupère une valeur spécifique
   */
  getValue(key, defaultValue = null) {
    if (!this.config) {
      return defaultValue;
    }
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Active/désactive la protection
   */
  async setProtectionEnabled(enabled) {
    return await this.set('protectionEnabled', enabled);
  }

  /**
   * Met à jour les sources de blocklists
   */
  async updateBlocklistSources(sources) {
    return await this.update({ blocklistSources: sources });
  }

  /**
   * Met à jour le port du proxy
   */
  async setProxyPort(port) {
    if (port < 1024 || port > 65535) {
      throw new Error('Port invalide. Doit être entre 1024 et 65535.');
    }
    return await this.set('proxyPort', port);
  }

  /**
   * Marque la dernière mise à jour des blocklists
   */
  async markLastUpdate() {
    return await this.set('lastUpdate', new Date().toISOString());
  }

  /**
   * Marque l'application comme installée
   */
  async markInstalled() {
    return await this.update({
      installed: true,
      installedAt: new Date().toISOString()
    });
  }

  /**
   * Vérifie si la mise à jour des blocklists est nécessaire
   */
  needsUpdate() {
    if (!this.config || !this.config.lastUpdate) {
      return true;
    }

    const lastUpdate = new Date(this.config.lastUpdate);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

    return hoursSinceUpdate >= this.config.updateInterval;
  }

  /**
   * Récupère les URLs de blocklists actives
   */
  getActiveBlocklistURLs() {
    if (!this.config) {
      return [];
    }

    const urls = [];
    const sources = this.config.blocklistSources;
    const urlMap = this.config.blocklistURLs;

    for (const [source, enabled] of Object.entries(sources)) {
      if (enabled && urlMap[source]) {
        urls.push({
          name: source,
          url: urlMap[source],
          format: this.getBlocklistFormat(source)
        });
      }
    }

    return urls;
  }

  /**
   * Détermine le format d'une blocklist
   */
  getBlocklistFormat(sourceName) {
    // Format hosts: urlhaus, stevenBlack, easylistFR
    // Format simple: hageziUltimate, phishingArmy
    const hostsFormat = ['urlhaus', 'stevenBlack', 'easylistFR'];
    return hostsFormat.includes(sourceName) ? 'hosts' : 'simple';
  }

  /**
   * Reset à la configuration par défaut
   */
  async reset() {
    this.config = this.getDefaultConfig();
    await this.save();
    return this.get();
  }

  /**
   * Exporte la configuration
   */
  async export(filepath) {
    try {
      // Valider le chemin de fichier (protège contre path traversal)
      const validatedPath = await validateFilePathForWrite(filepath, null, ['.json']);

      const content = JSON.stringify(this.config, null, 2);
      await fs.writeFile(validatedPath, content, 'utf-8');
      return { success: true, filepath: validatedPath };
    } catch (error) {
      console.error('Erreur export configuration:', error);
      throw error;
    }
  }

  /**
   * Importe une configuration
   */
  async import(filepath) {
    try {
      // Valider le chemin de fichier (protège contre path traversal)
      const validatedPath = await validateFilePathForRead(filepath, null, ['.json']);

      const content = await fs.readFile(validatedPath, 'utf-8');
      const importedConfig = JSON.parse(content);

      // Valider la configuration
      if (!importedConfig || typeof importedConfig !== 'object') {
        throw new Error('Configuration invalide');
      }

      // Merger avec défauts pour sécurité
      this.config = { ...this.getDefaultConfig(), ...importedConfig };
      await this.save();

      return this.get();
    } catch (error) {
      console.error('Erreur import configuration:', error);
      throw error;
    }
  }

  /**
   * Chemin du dossier de configuration
   */
  getConfigDir() {
    return this.configDir;
  }
}

// Export singleton
const configManager = new ConfigManager();

module.exports = configManager;
