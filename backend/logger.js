const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { validateFilePathForWrite } = require('./path-validator');

/**
 * Système de logging centralisé avec buffer en mémoire et export fichiers
 */
class Logger extends EventEmitter {
  constructor(maxBufferSize = 1000) {
    super();
    this.maxBufferSize = maxBufferSize;
    this.logBuffer = [];
    this.securityEventBuffer = [];
    this.nextLogId = 1;
    this.nextEventId = 1;
    this._rotationCheck = null;  // Throttle rotation check

    // Chemin des fichiers de persistance
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    this.configDir = path.join(appData, 'CalmWeb');
    this.statsFile = path.join(this.configDir, 'stats.json');
    this.logsFile = path.join(this.configDir, 'logs-persistent.json');
    this.securityEventsFile = path.join(this.configDir, 'security-events-persistent.json');

    // Créer le répertoire de config s'il n'existe pas
    this.ensureConfigDir().catch(err => {
      console.error('Erreur création répertoire config:', err);
    });

    // Statistiques temps réel
    this.stats = {
      blockedToday: 0,
      totalBlocked: 0,
      allowedToday: 0,
      totalAllowed: 0,
      lastThreat: null,
      startOfDay: new Date().setHours(0, 0, 0, 0),
      yesterdayBlocked: 0 // Pour calculer la tendance
    };

    // Compteurs par catégorie
    this.categoryCounters = {};
    this.domainCounters = {};

    // Charger les statistiques et logs persistants
    this.loadStats().catch(err => {
      console.error('Erreur chargement statistiques:', err);
    });
    this.loadPersistentLogs().catch(err => {
      console.error('Erreur chargement logs persistants:', err);
    });
    this.loadPersistentSecurityEvents().catch(err => {
      console.error('Erreur chargement événements sécurité persistants:', err);
    });

    // Nettoyer les logs de plus de 31 jours au démarrage
    this.cleanOldLogs().catch(err => {
      console.error('Erreur nettoyage logs anciens:', err);
    });
    this.cleanOldSecurityEvents().catch(err => {
      console.error('Erreur nettoyage événements anciens:', err);
    });

    // Reset quotidien à minuit
    this.scheduleDailyResetStats();

    // Nettoyage mensuel automatique
    this.scheduleMonthlyCleanup();
  }

  /**
   * S'assure que le répertoire de configuration existe
   */
  async ensureConfigDir() {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      // Ignore si le répertoire existe déjà
    }
  }

  /**
   * Enregistre un log système
   * @param {string} level - INFO, WARNING, ERROR
   * @param {string} message
   */
  log(level, message) {
    const logEntry = {
      id: String(this.nextLogId++),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message
    };

    // Ajouter au buffer
    this.logBuffer.push(logEntry);

    // Limiter la taille du buffer
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Émettre l'événement pour mise à jour temps réel
    this.emit('log', logEntry);

    // Console output
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    console.log(`[${timestamp}] [${level}] ${message}`);

    // Persister le log (async, sans bloquer)
    this.persistLog(logEntry).catch(err => {
      console.error('Erreur persistance log:', err.message);
    });

    return logEntry;
  }

  /**
   * Log INFO
   */
  info(message) {
    return this.log('INFO', message);
  }

  /**
   * Log WARNING
   */
  warn(message) {
    return this.log('WARNING', message);
  }

  /**
   * Log ERROR
   */
  error(message) {
    return this.log('ERROR', message);
  }

  /**
   * Enregistre un événement de sécurité (domaine bloqué/autorisé)
   * @param {object} event
   */
  logSecurityEvent(event) {
    const securityEvent = {
      id: `ev${this.nextEventId++}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Ajouter au buffer
    this.securityEventBuffer.push(securityEvent);

    // Limiter la taille du buffer
    if (this.securityEventBuffer.length > this.maxBufferSize) {
      this.securityEventBuffer.shift();
    }

    // Mettre à jour les statistiques
    this.updateStats(securityEvent);

    // Émettre pour temps réel
    this.emit('security_event', securityEvent);

    // Persister l'événement de sécurité (async, sans bloquer)
    this.persistSecurityEvent(securityEvent).catch(err => {
      console.error('Erreur persistance événement sécurité:', err.message);
    });

    return securityEvent;
  }

  /**
   * Enregistre un blocage
   */
  logBlocked(domain, reason, source) {
    return this.logSecurityEvent({
      type: 'blocked',
      domain,
      reason,
      source
    });
  }

  /**
   * Enregistre un accès autorisé
   */
  logAllowed(domain) {
    return this.logSecurityEvent({
      type: 'allowed',
      domain
    });
  }

  /**
   * Met à jour les statistiques
   */
  updateStats(event) {
    // Vérifier si on a changé de jour
    const now = new Date();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    if (startOfToday > this.stats.startOfDay) {
      this.resetDailyStats();
    }

    if (event.type === 'blocked') {
      this.stats.blockedToday++;
      this.stats.totalBlocked++;
      this.stats.lastThreat = {
        domain: event.domain,
        timestamp: event.timestamp
      };

      // Compteur de catégorie
      const category = event.reason || 'Autre';
      this.categoryCounters[category] = (this.categoryCounters[category] || 0) + 1;

      // Compteur de domaine
      this.domainCounters[event.domain] = this.domainCounters[event.domain] || {
        count: 0,
        threatType: event.reason,
        source: event.source
      };
      this.domainCounters[event.domain].count++;

    } else if (event.type === 'allowed') {
      this.stats.allowedToday++;
      this.stats.totalAllowed++;
    }

    // Émettre mise à jour stats
    this.emit('stats_updated', this.getStats());

    // Sauvegarder les statistiques
    this.saveStats().catch(err => {
      console.error('Erreur sauvegarde statistiques:', err);
    });
  }

  /**
   * Charge les statistiques depuis le fichier
   */
  async loadStats() {
    try {
      const content = await fs.readFile(this.statsFile, 'utf-8');
      const savedStats = JSON.parse(content);

      // Charger les totaux (qui persistent entre les redémarrages)
      this.stats.totalBlocked = savedStats.totalBlocked || 0;
      this.stats.totalAllowed = savedStats.totalAllowed || 0;

      // Vérifier si c'est le même jour
      const savedDate = savedStats.startOfDay ? new Date(savedStats.startOfDay) : null;
      const today = new Date().setHours(0, 0, 0, 0);

      if (savedDate && savedDate.getTime() === today) {
        // Même jour, restaurer les stats quotidiennes
        this.stats.blockedToday = savedStats.blockedToday || 0;
        this.stats.allowedToday = savedStats.allowedToday || 0;
        this.stats.lastThreat = savedStats.lastThreat || null;
        this.stats.yesterdayBlocked = savedStats.yesterdayBlocked || 0;
      } else {
        // Nouveau jour : les stats d'hier deviennent celles sauvegardées
        this.stats.yesterdayBlocked = savedStats.blockedToday || 0;
      }

      console.log(`[Logger] Statistiques chargées: ${this.stats.totalBlocked} total bloqués`);
    } catch (error) {
      // Fichier n'existe pas ou erreur, utiliser valeurs par défaut
      console.log('[Logger] Aucune statistique sauvegardée trouvée, démarrage à zéro');
    }
  }

  /**
   * Sauvegarde les statistiques dans le fichier
   */
  async saveStats() {
    try {
      // S'assurer que le répertoire existe
      await this.ensureConfigDir();

      const statsToSave = {
        totalBlocked: this.stats.totalBlocked,
        totalAllowed: this.stats.totalAllowed,
        blockedToday: this.stats.blockedToday,
        allowedToday: this.stats.allowedToday,
        yesterdayBlocked: this.stats.yesterdayBlocked,
        lastThreat: this.stats.lastThreat,
        startOfDay: this.stats.startOfDay,
        lastSaved: new Date().toISOString()
      };

      const content = JSON.stringify(statsToSave, null, 2);
      await fs.writeFile(this.statsFile, content, 'utf-8');
    } catch (error) {
      // Erreur silencieuse pour ne pas perturber le fonctionnement
      console.error('[Logger] Erreur sauvegarde stats:', error.message);
    }
  }

  /**
   * Obtient les statistiques actuelles
   */
  getStats() {
    return {
      blockedToday: {
        value: this.stats.blockedToday,
        trend: this.calculateTrend()
      },
      totalBlocked: this.stats.totalBlocked,
      lastThreat: this.stats.lastThreat,
      allowedToday: this.stats.allowedToday,
      totalAllowed: this.stats.totalAllowed
    };
  }

  /**
   * Calcule la tendance (variation par rapport à hier)
   */
  calculateTrend() {
    // Si pas de données hier, retourner 0
    if (this.stats.yesterdayBlocked === 0) {
      return 0;
    }

    // Calculer le pourcentage de variation
    const diff = this.stats.blockedToday - this.stats.yesterdayBlocked;
    const percentChange = Math.round((diff / this.stats.yesterdayBlocked) * 100);

    return percentChange;
  }

  /**
   * Reset les stats quotidiennes
   */
  resetDailyStats() {
    // Sauvegarder les stats d'aujourd'hui comme celles d'hier
    this.stats.yesterdayBlocked = this.stats.blockedToday;

    // Réinitialiser les stats du jour
    this.stats.blockedToday = 0;
    this.stats.allowedToday = 0;
    this.stats.startOfDay = new Date().setHours(0, 0, 0, 0);
    this.categoryCounters = {};
    this.domainCounters = {};
    this.info('Statistiques quotidiennes réinitialisées');

    // Sauvegarder immédiatement
    this.saveStats();
  }

  /**
   * Planifie le reset quotidien
   */
  scheduleDailyResetStats() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyStats();
      // Replanifier pour demain
      this.scheduleDailyResetStats();
    }, msUntilMidnight);
  }

  /**
   * Nettoie les logs de plus de 31 jours
   */
  async cleanOldLogs() {
    try {
      const content = await fs.readFile(this.logsFile, 'utf-8');
      const logs = JSON.parse(content);

      // Calculer la date limite (31 jours)
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      // Filtrer les logs récents
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= thirtyOneDaysAgo;
      });

      // Si des logs ont été supprimés, sauvegarder
      if (recentLogs.length < logs.length) {
        await fs.writeFile(this.logsFile, JSON.stringify(recentLogs, null, 2), 'utf-8');
        const deleted = logs.length - recentLogs.length;
        console.log(`[Logger] ${deleted} logs de plus de 31 jours supprimés`);
      }
    } catch (error) {
      // Fichier n'existe pas ou erreur, ignorer
    }
  }

  /**
   * Nettoie les événements de sécurité de plus de 31 jours
   */
  async cleanOldSecurityEvents() {
    try {
      const content = await fs.readFile(this.securityEventsFile, 'utf-8');
      const events = JSON.parse(content);

      // Calculer la date limite (31 jours)
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      // Filtrer les événements récents
      const recentEvents = events.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= thirtyOneDaysAgo;
      });

      // Si des événements ont été supprimés, sauvegarder
      if (recentEvents.length < events.length) {
        await fs.writeFile(this.securityEventsFile, JSON.stringify(recentEvents, null, 2), 'utf-8');
        const deleted = events.length - recentEvents.length;
        console.log(`[Logger] ${deleted} événements de plus de 31 jours supprimés`);
      }
    } catch (error) {
      // Fichier n'existe pas ou erreur, ignorer
    }
  }

  /**
   * Planifie le nettoyage mensuel automatique
   */
  scheduleMonthlyCleanup() {
    // Exécuter le nettoyage tous les 31 jours
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;

    setInterval(async () => {
      console.log('[Logger] Nettoyage automatique des logs de plus de 31 jours...');
      await this.cleanOldLogs();
      await this.cleanOldSecurityEvents();
    }, thirtyOneDays);
  }

  /**
   * Récupère les logs avec filtres optionnels et pagination
   * @param {object} filters - Filtres optionnels
   * @param {number} page - Numéro de page (commence à 1)
   * @param {number} pageSize - Nombre d'éléments par page
   */
  async getLogs(filters = {}, page = 1, pageSize = 50) {
    try {
      // Charger tous les logs persistants
      const allLogs = await this.loadAllPersistentLogs();

      // Appliquer les filtres
      let filteredLogs = allLogs;

      if (filters.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level);
      }

      // Trier par timestamp décroissant
      filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Calculer la pagination
      const total = filteredLogs.length;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedLogs = filteredLogs.slice(offset, offset + pageSize);

      return {
        data: paginatedLogs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error('Erreur getLogs:', error);
      // Fallback sur le buffer mémoire
      let logs = [...this.logBuffer];
      if (filters.level) {
        logs = logs.filter(log => log.level === filters.level);
      }
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const total = logs.length;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;

      return {
        data: logs.slice(offset, offset + pageSize),
        pagination: { page, pageSize, total, totalPages }
      };
    }
  }

  /**
   * Récupère les événements de sécurité avec filtres et pagination
   * @param {object} filters - Filtres optionnels
   * @param {number} page - Numéro de page (commence à 1)
   * @param {number} pageSize - Nombre d'éléments par page
   */
  async getSecurityEvents(filters = {}, page = 1, pageSize = 50) {
    try {
      // Charger tous les événements persistants
      const allEvents = await this.loadAllPersistentSecurityEvents();

      // Appliquer les filtres
      let filteredEvents = allEvents;

      if (filters.type) {
        filteredEvents = filteredEvents.filter(e => e.type === filters.type);
      }

      if (filters.reason) {
        filteredEvents = filteredEvents.filter(e => e.reason === filters.reason);
      }

      if (filters.source) {
        filteredEvents = filteredEvents.filter(e => e.source === filters.source);
      }

      if (filters.domain) {
        filteredEvents = filteredEvents.filter(e => e.domain.includes(filters.domain));
      }

      // Trier par timestamp décroissant
      filteredEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Calculer la pagination
      const total = filteredEvents.length;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;
      const paginatedEvents = filteredEvents.slice(offset, offset + pageSize);

      return {
        data: paginatedEvents,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error('Erreur getSecurityEvents:', error);
      // Fallback sur le buffer mémoire
      let events = [...this.securityEventBuffer];

      if (filters.type) {
        events = events.filter(e => e.type === filters.type);
      }
      if (filters.reason) {
        events = events.filter(e => e.reason === filters.reason);
      }
      if (filters.source) {
        events = events.filter(e => e.source === filters.source);
      }
      if (filters.domain) {
        events = events.filter(e => e.domain.includes(filters.domain));
      }

      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const total = events.length;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;

      return {
        data: events.slice(offset, offset + pageSize),
        pagination: { page, pageSize, total, totalPages }
      };
    }
  }

  /**
   * Récupère les top catégories bloquées
   */
  getTopBlockedCategories() {
    const categories = Object.entries(this.categoryCounters)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return categories;
  }

  /**
   * Récupère les top domaines bloqués
   */
  getTopBlockedDomains() {
    const domains = Object.entries(this.domainCounters)
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        threatType: data.threatType,
        source: data.source
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return domains;
  }

  /**
   * Génère une analyse de menaces
   */
  getThreatAnalysis() {
    const topDomain = this.getTopBlockedDomains()[0];
    const topCategory = this.getTopBlockedCategories()[0];
    const trend = this.calculateTrend();

    let title = "Analyse de la journée";
    let summary = "";
    let recommendation = "";

    if (!topDomain || !topCategory) {
      summary = "Aucune menace détectée aujourd'hui. Votre navigation est sécurisée.";
      recommendation = "Conseil : Continuez à naviguer prudemment et vérifiez régulièrement les mises à jour.";
    } else {
      if (trend > 0) {
        summary = `L'activité de blocage est en hausse de ${trend}% aujourd'hui, principalement due à une augmentation de sites de type "${topCategory.name}". Le domaine "${topDomain.domain}" a été le plus fréquemment bloqué (${topDomain.count} fois).`;
      } else if (trend < 0) {
        summary = `L'activité de blocage est en baisse de ${Math.abs(trend)}% aujourd'hui. Le domaine "${topDomain.domain}" a été bloqué ${topDomain.count} fois.`;
      } else {
        summary = `L'activité de blocage est stable aujourd'hui. Le domaine "${topDomain.domain}" a été le plus fréquemment bloqué (${topDomain.count} fois).`;
      }

      if (topCategory.name === 'Phishing') {
        recommendation = "Conseil : Soyez particulièrement vigilant avec les e-mails demandant vos informations personnelles ou bancaires.";
      } else if (topCategory.name === 'Scam') {
        recommendation = "Conseil : Méfiez-vous des offres trop alléchantes promettant des gains faciles ou des prix exceptionnels.";
      } else if (topCategory.name === 'Malware') {
        recommendation = "Conseil : Évitez de télécharger des fichiers depuis des sources non vérifiées.";
      } else {
        recommendation = "Conseil : Continuez à suivre les bonnes pratiques de sécurité en ligne.";
      }
    }

    return { title, summary, recommendation };
  }

  /**
   * Exporte les logs en fichier texte
   */
  async exportLogsToFile(filepath) {
    try {
      // Valider le chemin de fichier (protège contre path traversal)
      const validatedPath = await validateFilePathForWrite(filepath, null, ['.txt', '.log']);

      const logs = this.getLogs();
      const content = logs.map(log =>
        `${log.timestamp} [${log.level}] ${log.message}`
      ).join('\n');

      await fs.writeFile(validatedPath, content, 'utf-8');
      return { success: true, filepath: validatedPath };
    } catch (error) {
      this.error(`Erreur export logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Génère un rapport de diagnostic
   */
  async generateDiagnosticReport(config) {
    const report = [];
    report.push('='.repeat(60));
    report.push('RAPPORT DE DIAGNOSTIC CALMWEB');
    report.push('='.repeat(60));
    report.push('');
    report.push(`Date: ${new Date().toLocaleString('fr-FR')}`);
    report.push('');
    report.push('CONFIGURATION:');
    report.push('-'.repeat(60));
    report.push(JSON.stringify(config, null, 2));
    report.push('');
    report.push('STATISTIQUES:');
    report.push('-'.repeat(60));
    const stats = this.getStats();
    report.push(`Bloqués aujourd'hui: ${stats.blockedToday.value}`);
    report.push(`Total bloqués: ${stats.totalBlocked}`);
    report.push(`Autorisés aujourd'hui: ${stats.allowedToday}`);
    report.push(`Total autorisés: ${stats.totalAllowed}`);
    report.push('');
    report.push('DERNIERS LOGS:');
    report.push('-'.repeat(60));
    const recentLogs = this.getLogs().slice(0, 20);
    recentLogs.forEach(log => {
      report.push(`${log.timestamp} [${log.level}] ${log.message}`);
    });
    report.push('');
    report.push('TOP DOMAINES BLOQUÉS:');
    report.push('-'.repeat(60));
    const topDomains = this.getTopBlockedDomains();
    topDomains.forEach((d, i) => {
      report.push(`${i + 1}. ${d.domain} - ${d.count} fois (${d.threatType})`);
    });
    report.push('');
    report.push('='.repeat(60));

    return report.join('\n');
  }

  /**
   * Persiste un log dans le fichier
   */
  /**
   * Persiste un log avec append-only (évite la fuite mémoire)
   */
  async persistLog(logEntry) {
    try {
      // S'assurer que le répertoire existe
      await this.ensureConfigDir();

      // Append seulement (O(1) au lieu de O(n))
      const line = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logsFile, line, 'utf-8');

      // Vérifier rotation si nécessaire (throttled)
      this.checkLogRotation();
    } catch (error) {
      // Erreur silencieuse pour ne pas bloquer l'application
    }
  }

  /**
   * Vérifie si la rotation des logs est nécessaire (throttled)
   */
  checkLogRotation() {
    // Throttled check (max 1x par minute)
    if (this._rotationCheck) return;

    this._rotationCheck = setTimeout(async () => {
      this._rotationCheck = null;
      try {
        const stats = await fs.stat(this.logsFile);
        if (stats.size > 10 * 1024 * 1024) {  // 10 MB
          await this.rotateLogs();
        }
      } catch (err) {
        // Fichier n'existe pas encore, ignorer
      }
    }, 60000);  // 1 minute
  }

  /**
   * Effectue la rotation des logs
   */
  async rotateLogs() {
    try {
      const oldFile = this.logsFile + '.old';

      // Renommer l'ancien fichier
      try {
        await fs.rename(this.logsFile, oldFile);
        console.log('✓ Rotation des logs effectuée (fichier > 10 MB)');
      } catch (err) {
        // Ignorer si le fichier n'existe pas
      }

      // L'ancien fichier .old sera écrasé à la prochaine rotation
      // Cela conserve environ 20 MB de logs au total
    } catch (error) {
      console.error('Erreur rotation logs:', error);
    }
  }

  /**
   * Persiste un événement de sécurité dans le fichier
   */
  async persistSecurityEvent(event) {
    try {
      // S'assurer que le répertoire existe
      await this.ensureConfigDir();

      let events = [];
      try {
        const content = await fs.readFile(this.securityEventsFile, 'utf-8');
        events = JSON.parse(content);
      } catch (err) {
        // Fichier n'existe pas encore
      }

      events.push(event);
      await fs.writeFile(this.securityEventsFile, JSON.stringify(events, null, 2), 'utf-8');
    } catch (error) {
      // Erreur silencieuse pour ne pas bloquer l'application
    }
  }

  /**
   * Charge les logs persistants au démarrage
   */
  async loadPersistentLogs() {
    try {
      const content = await fs.readFile(this.logsFile, 'utf-8');
      const logs = JSON.parse(content);

      // Mettre à jour nextLogId pour éviter les collisions
      if (logs.length > 0) {
        const maxId = Math.max(...logs.map(l => parseInt(l.id) || 0));
        this.nextLogId = maxId + 1;
      }

      console.log(`[Logger] ${logs.length} logs persistants chargés`);
    } catch (error) {
      console.log('[Logger] Aucun log persistant trouvé');
    }
  }

  /**
   * Charge les événements de sécurité persistants au démarrage
   */
  async loadPersistentSecurityEvents() {
    try {
      const content = await fs.readFile(this.securityEventsFile, 'utf-8');
      const events = JSON.parse(content);

      // Mettre à jour nextEventId pour éviter les collisions
      if (events.length > 0) {
        const maxId = Math.max(...events.map(e => {
          const id = e.id.replace('ev', '');
          return parseInt(id) || 0;
        }));
        this.nextEventId = maxId + 1;
      }

      console.log(`[Logger] ${events.length} événements de sécurité persistants chargés`);
    } catch (error) {
      console.log('[Logger] Aucun événement de sécurité persistant trouvé');
    }
  }

  /**
   * Charge tous les logs persistants (pour pagination)
   */
  async loadAllPersistentLogs() {
    try {
      const content = await fs.readFile(this.logsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Charge tous les événements de sécurité persistants (pour pagination)
   */
  async loadAllPersistentSecurityEvents() {
    try {
      const content = await fs.readFile(this.securityEventsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Nettoie les buffers (pour tests)
   */
  clear() {
    this.logBuffer = [];
    this.securityEventBuffer = [];
    this.categoryCounters = {};
    this.domainCounters = {};
  }
}

// Export singleton
const logger = new Logger();

module.exports = logger;
