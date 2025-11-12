const fs = require('fs').promises;
const path = require('path');
const { matchesDomainPattern, isIPInCIDR, looksLikeIP, resolveHostname, cleanDomain } = require('./utils');
const logger = require('./logger');

/**
 * Gestionnaire de whitelist (domaines autorisés)
 * Supporte: domaines exacts, wildcards (*.example.com), IP, CIDR
 */
class WhitelistManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.whitelist = new Map(); // domain -> { id, domain, ipAddress, createdAt, hits, lastUsed }
    this.whitelistFile = null;
    this.nextId = 1;
    this._saveTimeout = null; // Pour throttling des sauvegardes
  }

  /**
   * Initialise le gestionnaire
   */
  async initialize() {
    const configDir = this.configManager.getConfigDir();
    this.whitelistFile = path.join(configDir, 'whitelist.json');
    await this.load();

    // Télécharger et intégrer la whitelist GitHub si elle n'a jamais été chargée
    const config = this.configManager.get();
    if (!config.whitelistGitHubLoaded) {
      try {
        logger.info('Téléchargement de la whitelist GitHub...');
        const added = await this.downloadGitHubWhitelist();
        await this.configManager.update({ whitelistGitHubLoaded: true });
        logger.info(`✓ Whitelist GitHub téléchargée: ${added} domaines ajoutés`);
      } catch (error) {
        logger.warn(`✗ Impossible de télécharger la whitelist GitHub: ${error.message}`);
      }
    }

    // Télécharger et intégrer useful domains si l'option est activée
    if (config.enableUsefulDomains && !config.usefulDomainsLoaded) {
      try {
        logger.info('Téléchargement des Useful Domains...');
        const added = await this.downloadUsefulDomains();
        await this.configManager.update({ usefulDomainsLoaded: true });
        logger.info(`✓ Useful Domains téléchargés: ${added} domaines ajoutés`);
      } catch (error) {
        logger.warn(`✗ Impossible de télécharger les useful domains: ${error.message}`);
      }
    }

    const userDomains = Array.from(this.whitelist.values()).filter(e => !e.isSystemDomain).length;
    const systemDomains = Array.from(this.whitelist.values()).filter(e => e.isSystemDomain).length;
    logger.info(`✓ Whitelist initialisée: ${this.whitelist.size} entrées (${systemDomains} système, ${userDomains} utilisateur)`);
  }

  /**
   * Charge la whitelist depuis le fichier
   */
  async load() {
    try {
      const content = await fs.readFile(this.whitelistFile, 'utf-8');
      const data = JSON.parse(content);

      // Liste des domaines système à identifier
      const systemDomains = [
        'microsoft.com',
        '*.microsoft.com',
        'windowsupdate.com',
        '*.windowsupdate.com',
        'update.microsoft.com',
        'download.windowsupdate.com',
        '192.168.0.0/16',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '127.0.0.0/8',
        // Domaines GitHub whitelist
        'data.microsoft.com',
        'mp.microsoft.com',
        'msecnd.net',
        'msftidentity.com',
        'msftauth.net',
        'digicert.com',
        'ctldl.windowsupdate.com',
        'drive.google.com',
        'ooklaserver.net',
        '*.ooklaserver.net'
      ];

      this.whitelist.clear();
      if (Array.isArray(data)) {
        data.forEach(entry => {
          // Migration: marquer les domaines système existants
          if (entry.isSystemDomain === undefined) {
            entry.isSystemDomain = systemDomains.includes(entry.domain);
          }

          this.whitelist.set(entry.domain, entry);
          if (entry.id >= this.nextId) {
            this.nextId = entry.id + 1;
          }
        });

        // Sauvegarder avec les nouveaux champs
        await this.save();
      }
    } catch (error) {
      // Fichier n'existe pas ou erreur, créer whitelist par défaut
      await this.createDefaultWhitelist();
    }
  }

  /**
   * Crée une whitelist par défaut avec domaines essentiels
   */
  async createDefaultWhitelist() {
    const defaultDomains = [
      'microsoft.com',
      '*.microsoft.com',
      'windowsupdate.com',
      '*.windowsupdate.com',
      'update.microsoft.com',
      'download.windowsupdate.com',
      '192.168.0.0/16',  // Réseau local privé
      '10.0.0.0/8',      // Réseau local privé
      '172.16.0.0/12',   // Réseau local privé
      '127.0.0.0/8',     // Localhost
      'ooklaserver.net',
      '*.ooklaserver.net'  // Speedtest
    ];

    for (const domain of defaultDomains) {
      await this.add(domain, false, true); // false = ne pas sauvegarder, true = domaine système
    }

    await this.save();
    logger.info('Whitelist par défaut créée');
  }

  /**
   * Sauvegarde la whitelist
   */
  async save() {
    try {
      const data = Array.from(this.whitelist.values());
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(this.whitelistFile, content, 'utf-8');
      return true;
    } catch (error) {
      logger.error(`Erreur sauvegarde whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ajoute un domaine à la whitelist
   */
  async add(domain, save = true, isSystemDomain = false) {
    const cleaned = cleanDomain(domain);

    if (!cleaned) {
      throw new Error('Domaine invalide');
    }

    // Vérifier si déjà présent
    if (this.whitelist.has(cleaned)) {
      throw new Error('Ce domaine est déjà dans la liste blanche.');
    }

    // Résoudre l'IP si c'est un domaine
    let ipAddress = null;
    if (!looksLikeIP(cleaned) && !cleaned.includes('*') && !cleaned.includes('/')) {
      ipAddress = await resolveHostname(cleaned);
    }

    const entry = {
      id: this.nextId++,
      domain: cleaned,
      ipAddress: ipAddress || 'N/A',
      createdAt: new Date().toISOString(),
      hits: 0,
      lastUsed: null,
      isSystemDomain: isSystemDomain
    };

    this.whitelist.set(cleaned, entry);

    if (save) {
      await this.save();
      // Notifier que la liste a changé
      this.notifyListChanged();
    }

    logger.info(`Domaine ajouté à la whitelist: ${cleaned}`);
    return entry;
  }

  /**
   * Supprime un domaine de la whitelist
   */
  async remove(domain) {
    const cleaned = cleanDomain(domain);

    if (!this.whitelist.has(cleaned)) {
      throw new Error('Domaine non trouvé dans la whitelist');
    }

    this.whitelist.delete(cleaned);
    await this.save();

    // Notifier que la liste a changé
    this.notifyListChanged();

    logger.info(`Domaine retiré de la whitelist: ${cleaned}`);
    return { message: 'Domaine supprimé avec succès' };
  }

  /**
   * Vérifie si un domaine/IP est whitelisté
   */
  isWhitelisted(hostname) {
    if (!hostname) return false;

    const cleaned = cleanDomain(hostname);

    // 1. Vérification exacte
    if (this.whitelist.has(cleaned)) {
      this.incrementHits(cleaned);
      return true;
    }

    // 2. Vérification des wildcards
    for (const [pattern, entry] of this.whitelist.entries()) {
      if (pattern.includes('*')) {
        if (matchesDomainPattern(cleaned, pattern)) {
          this.incrementHits(pattern);
          return true;
        }
      }
    }

    // 3. Vérification des domaines parents
    // Exemple: pour "sub.domain.example.com", vérifie "domain.example.com" puis "example.com"
    // Ceci permet à "ooklaserver.net" d'autoriser "plau01speedtst0.sunrise.ch.prod.hosts.ooklaserver.net"
    const parts = cleaned.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');

      // Vérification exacte du parent
      if (this.whitelist.has(parent)) {
        this.incrementHits(parent);
        return true;
      }

      // Vérification wildcard du parent (ex: *.example.com)
      for (const [pattern, entry] of this.whitelist.entries()) {
        if (pattern.includes('*')) {
          if (matchesDomainPattern(parent, pattern)) {
            this.incrementHits(pattern);
            return true;
          }
        }
      }
    }

    // 4. Si c'est une IP, vérifier les ranges CIDR
    if (looksLikeIP(cleaned)) {
      for (const [pattern, entry] of this.whitelist.entries()) {
        if (pattern.includes('/')) {
          // C'est un CIDR
          if (isIPInCIDR(cleaned, pattern)) {
            this.incrementHits(pattern);
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Incrémente le compteur de hits
   */
  incrementHits(domain) {
    const entry = this.whitelist.get(domain);
    if (entry) {
      entry.hits++;
      entry.lastUsed = new Date().toISOString();

      // Sauvegarder de manière asynchrone et throttled pour éviter I/O excessif
      this.scheduleSave();
    }
  }

  /**
   * Planifie une sauvegarde throttled (max 1 fois toutes les 30 secondes)
   */
  scheduleSave() {
    if (this._saveTimeout) {
      return; // Une sauvegarde est déjà planifiée
    }

    this._saveTimeout = setTimeout(async () => {
      this._saveTimeout = null;
      try {
        await this.save();
      } catch (error) {
        // Erreur silencieuse, ne pas bloquer le flux
        console.error('Erreur sauvegarde whitelist hits:', error.message);
      }
    }, 30000); // 30 secondes
  }

  /**
   * Récupère la liste complète (seulement les domaines manuels, pas les domaines système)
   */
  getAll() {
    return Array.from(this.whitelist.values())
      .filter(entry => !entry.isSystemDomain)
      .sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
  }

  /**
   * Recherche dans la whitelist
   */
  search(query) {
    if (!query) return this.getAll();

    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(entry =>
      entry.domain.toLowerCase().includes(lowerQuery) ||
      (entry.ipAddress && entry.ipAddress.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Importe depuis un fichier CSV
   */
  async importFromCSV(content) {
    const lines = content.split('\n');
    let imported = 0;
    let errors = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('id,')) {
        continue; // Skip headers et commentaires
      }

      try {
        // Format: id,domain,ipAddress,createdAt
        const parts = trimmed.split(',');
        if (parts.length >= 2) {
          const domain = parts[1].trim();
          if (domain && !this.whitelist.has(cleanDomain(domain))) {
            await this.add(domain, false);
            imported++;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    await this.save();
    logger.info(`Import whitelist: ${imported} domaines importés, ${errors} erreurs`);

    return {
      message: `Importation réussie. ${imported} domaines ajoutés.`,
      imported,
      errors
    };
  }

  /**
   * Exporte vers CSV
   */
  async exportToCSV() {
    const data = this.getAll();
    const header = ['id', 'domain', 'ipAddress', 'createdAt', 'hits', 'lastUsed'];
    const rows = data.map(d =>
      [d.id, d.domain, d.ipAddress || '', d.createdAt, d.hits, d.lastUsed || ''].join(',')
    );

    const content = [header.join(','), ...rows].join('\n');

    return {
      content,
      filename: `calmweb_whitelist_${new Date().toISOString().split('T')[0]}.csv`
    };
  }

  /**
   * Nettoie la whitelist (pour tests)
   */
  clear() {
    this.whitelist.clear();
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return {
      total: this.whitelist.size,
      wildcards: Array.from(this.whitelist.keys()).filter(d => d.includes('*')).length,
      cidr: Array.from(this.whitelist.keys()).filter(d => d.includes('/')).length,
      domains: Array.from(this.whitelist.keys()).filter(d => !d.includes('*') && !d.includes('/')).length
    };
  }

  /**
   * Télécharge la whitelist depuis GitHub
   */
  async downloadGitHubWhitelist() {
    const https = require('https');
    const config = this.configManager.get();
    const url = config.whitelistGitHubURL;

    if (!url) {
      throw new Error('URL de la whitelist GitHub non configurée');
    }

    return new Promise((resolve, reject) => {
      https.get(url, { timeout: 30000 }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return resolve(this.downloadGitHubWhitelist(response.headers.location));
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', async () => {
          try {
            const lines = data.split('\n');
            let added = 0;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) {
                continue;
              }

              try {
                if (!this.whitelist.has(cleanDomain(trimmed))) {
                  await this.add(trimmed, false, true); // true = domaine système
                  added++;
                }
              } catch (error) {
                // Ignorer les erreurs individuelles
              }
            }

            await this.save();
            logger.info(`Whitelist GitHub: ${added} domaines ajoutés`);
            resolve(added);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject).on('timeout', () => {
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * Télécharge les useful domains depuis GitHub
   */
  async downloadUsefulDomains() {
    const https = require('https');
    const config = this.configManager.get();
    const url = config.usefulDomainsURL;

    if (!url) {
      throw new Error('URL des useful domains non configurée');
    }

    return new Promise((resolve, reject) => {
      https.get(url, { timeout: 30000 }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return resolve(this.downloadUsefulDomains(response.headers.location));
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        let data = '';
        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', async () => {
          try {
            const lines = data.split('\n');
            let added = 0;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) {
                continue;
              }

              try {
                if (!this.whitelist.has(cleanDomain(trimmed))) {
                  await this.add(trimmed, false, true); // true = domaine système
                  added++;
                }
              } catch (error) {
                // Ignorer les erreurs individuelles
              }
            }

            await this.save();
            logger.info(`Useful Domains: ${added} domaines ajoutés`);
            resolve(added);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject).on('timeout', () => {
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * Notifie qu'une liste a changé (callback pour fermer les connexions actives)
   */
  notifyListChanged() {
    if (this.onListChanged) {
      this.onListChanged();
    }
  }

  /**
   * Définit le callback appelé quand une liste change
   */
  setOnListChanged(callback) {
    this.onListChanged = callback;
  }
}

module.exports = WhitelistManager;
