const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { cleanDomain, parseHostsLine, parseSimpleListLine, retryWithBackoff } = require('./utils');
const logger = require('./logger');

/**
 * Gestionnaire de blocklist avec téléchargement multi-sources
 * Sources: URLhaus, StevenBlack, HaGeZi Ultimate, Phishing Army, Liste FR
 */
class BlocklistManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.blockedDomains = new Set();
    this.customBlockedDomains = new Set();
    this.blocklistFile = null;
    this.customBlocklistFile = null;
    this.metadataFile = null;
    this.isLoading = false;
    this.lastUpdate = null;
    this.updateIntervalId = null; // Stocker l'interval pour pouvoir le nettoyer

    // Métadonnées pour chaque liste (date de MAJ, âge, statut)
    this.listMetadata = {
      urlhaus: { lastUpdate: null, domainCount: 0, status: 'pending', priority: 1 },
      phishingArmy: { lastUpdate: null, domainCount: 0, status: 'pending', priority: 1 },
      hageziUltimate: { lastUpdate: null, domainCount: 0, status: 'pending', priority: 2 },
      stevenBlack: { lastUpdate: null, domainCount: 0, status: 'pending', priority: 3 },
      easylistFR: { lastUpdate: null, domainCount: 0, status: 'pending', priority: 4 },
    };
  }

  /**
   * Initialise le gestionnaire
   */
  async initialize() {
    const configDir = this.configManager.getConfigDir();
    this.blocklistFile = path.join(configDir, 'blocklist_cache.txt');
    this.customBlocklistFile = path.join(configDir, 'custom_blocklist.json');
    this.metadataFile = path.join(configDir, 'blocklist_metadata.json');

    // Charger les métadonnées
    await this.loadMetadata();

    // Charger la blocklist custom
    await this.loadCustomBlocklist();

    // Charger le cache ou télécharger
    const cacheExists = await this.cacheExists();
    if (cacheExists) {
      await this.loadFromCache();
    } else {
      await this.downloadAndUpdate();
    }

    // Planifier les mises à jour automatiques
    this.scheduleAutoUpdate();

    logger.info(`Blocklist initialisée avec ${this.blockedDomains.size} domaines bloqués`);
  }

  /**
   * Vérifie si le cache existe
   */
  async cacheExists() {
    try {
      await fs.access(this.blocklistFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Charge la blocklist depuis le cache
   */
  async loadFromCache() {
    try {
      const content = await fs.readFile(this.blocklistFile, 'utf-8');
      const lines = content.split('\n');

      this.blockedDomains.clear();

      // Liste des domaines remote desktop pour filtrage
      const remoteDesktopDomains = new Set(this.getRemoteDesktopDomains());
      const blockRemoteDesktop = this.configManager.getValue('blockRemoteDesktop', false);

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Si blockRemoteDesktop est désactivé, exclure les domaines remote desktop
          if (!blockRemoteDesktop && remoteDesktopDomains.has(trimmed)) {
            return; // Skip ce domaine
          }
          this.blockedDomains.add(trimmed);
        }
      });

      // Si blockRemoteDesktop est activé, ajouter les domaines remote desktop
      if (blockRemoteDesktop) {
        remoteDesktopDomains.forEach(d => this.blockedDomains.add(d));
      }

      logger.info(`Blocklist chargée depuis cache: ${this.blockedDomains.size} domaines`);
    } catch (error) {
      logger.error(`Erreur chargement cache: ${error.message}`);
    }
  }

  /**
   * Charge la blocklist custom
   */
  async loadCustomBlocklist() {
    try {
      const content = await fs.readFile(this.customBlocklistFile, 'utf-8');
      const data = JSON.parse(content);

      this.customBlockedDomains.clear();
      if (Array.isArray(data)) {
        data.forEach(entry => {
          this.customBlockedDomains.add(entry.domain);
        });
      }
    } catch (error) {
      // Fichier n'existe pas, c'est OK
      await this.saveCustomBlocklist();
    }
  }

  /**
   * Sauvegarde la blocklist custom
   */
  async saveCustomBlocklist() {
    try {
      const data = Array.from(this.customBlockedDomains).map((domain, index) => ({
        id: index + 1,
        domain,
        createdAt: new Date().toISOString(),
        hits: 0,
        lastUsed: null
      }));

      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(this.customBlocklistFile, content, 'utf-8');
    } catch (error) {
      logger.error(`Erreur sauvegarde custom blocklist: ${error.message}`);
    }
  }

  /**
   * Charge les métadonnées des listes
   */
  async loadMetadata() {
    try {
      const content = await fs.readFile(this.metadataFile, 'utf-8');
      const data = JSON.parse(content);
      this.listMetadata = { ...this.listMetadata, ...data };
      logger.info('Métadonnées des listes chargées');
    } catch (error) {
      // Fichier n'existe pas, utiliser les valeurs par défaut
      await this.saveMetadata();
    }
  }

  /**
   * Sauvegarde les métadonnées des listes
   */
  async saveMetadata() {
    try {
      const content = JSON.stringify(this.listMetadata, null, 2);
      await fs.writeFile(this.metadataFile, content, 'utf-8');
    } catch (error) {
      logger.error(`Erreur sauvegarde métadonnées: ${error.message}`);
    }
  }

  /**
   * Récupère les métadonnées (pour API/dashboard)
   */
  getMetadata() {
    return this.listMetadata;
  }

  /**
   * Vérifie si une liste doit être mise à jour
   */
  shouldUpdateList(listKey) {
    const metadata = this.listMetadata[listKey];
    if (!metadata || !metadata.lastUpdate) return true; // Jamais téléchargé

    const ageHours = (Date.now() - new Date(metadata.lastUpdate)) / (1000 * 60 * 60);
    const updateInterval = this.configManager.getValue('updateInterval', 24);

    return ageHours >= updateInterval;
  }

  /**
   * Formate l'âge d'une date
   */
  formatAge(date) {
    if (!date) return 'jamais';
    const hours = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60));
    if (hours < 1) return 'moins d\'1h';
    if (hours === 1) return '1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 jour';
    return `${days} jours`;
  }

  /**
   * Télécharge et met à jour les blocklists avec priorités et mise à jour progressive
   */
  async downloadAndUpdate() {
    if (this.isLoading) {
      logger.warn('Téléchargement déjà en cours');
      return;
    }

    this.isLoading = true;
    logger.info('═══════════════════════════════════════════════════');
    logger.info('   Mise à jour des blocklists');
    logger.info('═══════════════════════════════════════════════════');

    try {
      const sources = this.configManager.getActiveBlocklistURLs();
      const allDomains = new Set();

      // Trier par priorité (1 = haute priorité, 4 = basse priorité)
      sources.sort((a, b) => {
        const priorityA = this.listMetadata[a.name]?.priority || 99;
        const priorityB = this.listMetadata[b.name]?.priority || 99;
        return priorityA - priorityB;
      });

      logger.info(`${sources.length} liste(s) à vérifier (ordre de priorité)`);
      logger.info('');

      // Télécharger chaque source progressivement
      for (const source of sources) {
        const listKey = source.name;

        try {
          // Vérifier si la liste doit être mise à jour
          if (!this.shouldUpdateList(listKey)) {
            const age = this.formatAge(this.listMetadata[listKey].lastUpdate);
            const count = this.listMetadata[listKey].domainCount || 0;
            logger.info(`⏭️  ${source.name}: À jour (${age}, ${count.toLocaleString()} domaines)`);

            // Ajouter les domaines du cache à la collection
            const cached = this.listMetadata[listKey].domainCount || 0;
            if (cached > 0) {
              // Les domaines sont déjà dans blockedDomains du cache
            }
            continue;
          }

          logger.info(`⬇️  ${source.name}: Téléchargement...`);

          const domains = await retryWithBackoff(
            () => this.downloadBlocklist(source.url, source.format),
            3,
            2000
          );

          // Appliquer immédiatement à la blocklist (protection immédiate)
          domains.forEach(d => allDomains.add(d));

          // Mettre à jour les métadonnées
          this.listMetadata[listKey].lastUpdate = new Date();
          this.listMetadata[listKey].domainCount = domains.size;
          this.listMetadata[listKey].status = 'success';

          logger.info(`   ✓ ${source.name}: ${domains.size.toLocaleString()} domaines ajoutés`);

        } catch (error) {
          logger.error(`   ✗ ${source.name}: ${error.message}`);

          // Marquer comme erreur
          this.listMetadata[listKey].status = 'error';

          // Essayer d'utiliser le cache si disponible
          const cached = this.listMetadata[listKey].domainCount || 0;
          if (cached > 0) {
            const age = this.formatAge(this.listMetadata[listKey].lastUpdate);
            logger.warn(`   ⚠️  Mode cache: ${cached.toLocaleString()} domaines (âge: ${age})`);
            this.listMetadata[listKey].status = 'cache';
            // Les domaines du cache sont déjà dans blockedDomains
          } else {
            logger.error(`   ✗ Pas de cache disponible pour ${source.name}`);
          }
        }
      }

      logger.info('');

      // Ajouter les domaines de remote desktop (TeamViewer, AnyDesk, etc.)
      if (this.configManager.getValue('blockRemoteDesktop', false)) {
        const remoteDesktopDomains = this.getRemoteDesktopDomains();
        remoteDesktopDomains.forEach(d => allDomains.add(d));
        logger.info(`🚫 Domaines remote desktop ajoutés: ${remoteDesktopDomains.length}`);
      }

      // Mettre à jour la blocklist
      this.blockedDomains = allDomains;
      this.lastUpdate = new Date();

      // Sauvegarder le cache et les métadonnées
      await this.saveToCache();
      await this.saveMetadata();

      // Marquer la dernière mise à jour globale
      await this.configManager.markLastUpdate();

      logger.info('');
      logger.info('═══════════════════════════════════════════════════');
      logger.info(`✓ Mise à jour terminée: ${this.blockedDomains.size.toLocaleString()} domaines au total`);
      logger.info('═══════════════════════════════════════════════════');
    } catch (error) {
      logger.error(`Erreur mise à jour blocklists: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Télécharge une blocklist depuis une URL
   */
  async downloadBlocklist(url, format) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const domains = new Set();

      const request = protocol.get(url, { timeout: 30000 }, (response) => {
        // Gérer les redirections
        if (response.statusCode === 301 || response.statusCode === 302) {
          return resolve(this.downloadBlocklist(response.headers.location, format));
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const lines = data.split('\n');

            lines.forEach(line => {
              let domain = null;

              if (format === 'hosts') {
                domain = parseHostsLine(line);
              } else if (format === 'simple') {
                domain = parseSimpleListLine(line);
              }

              if (domain && domain.length > 0) {
                domains.add(domain);
              }
            });

            resolve(domains);
          } catch (error) {
            reject(error);
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * Liste des domaines remote desktop à bloquer
   */
  getRemoteDesktopDomains() {
    return [
      // TeamViewer
      'teamviewer.com',
      'tvc.teamviewer.com',
      'login.teamviewer.com',
      'download.teamviewer.com',

      // AnyDesk
      'anydesk.com',
      'download.anydesk.com',
      'net.anydesk.com',

      // LogMeIn
      'logmein.com',
      'secure.logmein.com',
      'authentication.logmein.com',

      // Chrome Remote Desktop
      'remotedesktop.google.com',
      'chromoting-pa.googleapis.com',

      // Microsoft Remote Assistance
      'remoteassistance.support.microsoft.com',

      // Autres
      'supremo.net',
      'splashtop.com',
      'ammyy.com',
      'ultraviewer.net',
      'rustdesk.com'
    ];
  }

  /**
   * Sauvegarde dans le cache
   */
  async saveToCache() {
    try {
      const domains = Array.from(this.blockedDomains).sort();
      const content = domains.join('\n');
      await fs.writeFile(this.blocklistFile, content, 'utf-8');
      logger.info('Cache blocklist sauvegardé');
    } catch (error) {
      logger.error(`Erreur sauvegarde cache: ${error.message}`);
    }
  }

  /**
   * Recharge la blocklist depuis le cache avec les nouveaux paramètres
   */
  async reload() {
    logger.info('═══════════════════════════════════════════════════');
    logger.info('   Rechargement de la blocklist...');
    logger.info('═══════════════════════════════════════════════════');

    const beforeCount = this.blockedDomains.size + this.customBlockedDomains.size;

    await this.loadFromCache();
    await this.loadCustomBlocklist();

    const afterCount = this.blockedDomains.size + this.customBlockedDomains.size;

    logger.info(`✓ Blocklist rechargée avec succès`);
    logger.info(`  - Domaines externes: ${this.blockedDomains.size.toLocaleString()}`);
    logger.info(`  - Domaines personnalisés: ${this.customBlockedDomains.size.toLocaleString()}`);
    logger.info(`  - Total: ${afterCount.toLocaleString()} domaines (${afterCount > beforeCount ? '+' : ''}${(afterCount - beforeCount).toLocaleString()})`);
    logger.info('═══════════════════════════════════════════════════');
  }

  /**
   * Vérifie si un domaine est bloqué
   */
  isBlocked(hostname) {
    if (!hostname) return false;

    const cleaned = cleanDomain(hostname);

    // Vérifier la blocklist principale
    if (this.blockedDomains.has(cleaned)) {
      return { blocked: true, reason: 'Malware', source: 'Blocklists' };
    }

    // Vérifier avec www.
    if (this.blockedDomains.has('www.' + cleaned)) {
      return { blocked: true, reason: 'Malware', source: 'Blocklists' };
    }

    // Vérifier sans www. si présent
    if (cleaned.startsWith('www.')) {
      const withoutWww = cleaned.substring(4);
      if (this.blockedDomains.has(withoutWww)) {
        return { blocked: true, reason: 'Malware', source: 'Blocklists' };
      }
    }

    // Vérifier la blocklist custom (match exact)
    if (this.customBlockedDomains.has(cleaned)) {
      return { blocked: true, reason: 'Custom', source: 'Liste Personnalisée' };
    }

    // Vérifier les sous-domaines (parents)
    const parts = cleaned.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');

      // Vérifier dans la blocklist principale
      if (this.blockedDomains.has(parent)) {
        return { blocked: true, reason: 'Malware', source: 'Blocklists' };
      }

      // Vérifier dans la blocklist custom
      if (this.customBlockedDomains.has(parent)) {
        return { blocked: true, reason: 'Custom', source: 'Liste Personnalisée' };
      }
    }

    return { blocked: false };
  }

  /**
   * Ajoute un domaine custom
   */
  async addCustomDomain(domain) {
    const cleaned = cleanDomain(domain);

    if (!cleaned) {
      throw new Error('Domaine invalide');
    }

    if (this.customBlockedDomains.has(cleaned)) {
      throw new Error('Ce domaine est déjà dans la liste noire.');
    }

    this.customBlockedDomains.add(cleaned);
    await this.saveCustomBlocklist();

    logger.info(`Domaine ajouté à la blocklist custom: ${cleaned}`);

    // Notifier que la liste a changé (pour fermer les connexions actives)
    this.notifyListChanged();

    return { message: 'Domaine ajouté avec succès' };
  }

  /**
   * Supprime un domaine custom
   */
  async removeCustomDomain(domain) {
    const cleaned = cleanDomain(domain);

    if (!this.customBlockedDomains.has(cleaned)) {
      throw new Error('Domaine non trouvé dans la blocklist');
    }

    this.customBlockedDomains.delete(cleaned);
    await this.saveCustomBlocklist();

    logger.info(`Domaine retiré de la blocklist custom: ${cleaned}`);

    // Notifier que la liste a changé (pour fermer les connexions actives)
    this.notifyListChanged();

    return { message: 'Domaine supprimé avec succès' };
  }

  /**
   * Récupère la liste custom
   */
  getCustomBlocklist() {
    return Array.from(this.customBlockedDomains).map((domain, index) => ({
      id: index + 1,
      domain,
      ipAddress: 'N/A',
      createdAt: new Date().toISOString(),
      hits: 0,
      lastUsed: null
    }));
  }

  /**
   * Planifie les mises à jour automatiques
   */
  scheduleAutoUpdate() {
    // Nettoyer l'interval existant s'il y en a un
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    const updateInterval = this.configManager.getValue('updateInterval', 24);
    const intervalMs = updateInterval * 60 * 60 * 1000; // Heures en ms

    this.updateIntervalId = setInterval(async () => {
      if (this.configManager.needsUpdate()) {
        logger.info('Mise à jour automatique des blocklists...');
        await this.downloadAndUpdate();
      }
    }, intervalMs);

    logger.info(`Mises à jour automatiques planifiées toutes les ${updateInterval}h`);
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

  /**
   * Nettoie les ressources (interval, etc.)
   */
  destroy() {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
      logger.info('Interval de mise à jour automatique nettoyé');
    }
  }

  /**
   * Force une mise à jour
   */
  async forceUpdate() {
    logger.info('Mise à jour forcée des blocklists');
    return await this.downloadAndUpdate();
  }

  /**
   * Obtient les statistiques
   */
  getStats() {
    return {
      totalBlocked: this.blockedDomains.size,
      customBlocked: this.customBlockedDomains.size,
      lastUpdate: this.lastUpdate,
      isLoading: this.isLoading
    };
  }

  /**
   * Importe depuis CSV
   */
  async importFromCSV(content) {
    const lines = content.split('\n');
    let imported = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('id,')) {
        continue;
      }

      try {
        const parts = trimmed.split(',');
        if (parts.length >= 2) {
          const domain = parts[1].trim();
          if (domain && !this.customBlockedDomains.has(cleanDomain(domain))) {
            this.customBlockedDomains.add(cleanDomain(domain));
            imported++;
          }
        }
      } catch (error) {
        // Ignorer les erreurs
      }
    }

    await this.saveCustomBlocklist();
    logger.info(`Import blocklist: ${imported} domaines importés`);

    return {
      message: `Importation réussie. ${imported} domaines ajoutés.`,
      imported
    };
  }

  /**
   * Exporte vers CSV
   */
  async exportToCSV() {
    const data = this.getCustomBlocklist();
    const header = ['id', 'domain', 'ipAddress', 'createdAt'];
    const rows = data.map(d =>
      [d.id, d.domain, d.ipAddress, d.createdAt].join(',')
    );

    const content = [header.join(','), ...rows].join('\n');

    return {
      content,
      filename: `calmweb_blocklist_${new Date().toISOString().split('T')[0]}.csv`
    };
  }
}

module.exports = BlocklistManager;
