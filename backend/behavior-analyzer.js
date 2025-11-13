const logger = require('./logger');

/**
 * Analyseur de comportement pour détecter les activités suspectes
 * Track les patterns de requêtes par IP et détecte les anomalies
 */
class BehaviorAnalyzer {
  constructor(options = {}) {
    this.hourlyThreshold = options.hourlyThreshold || 500;   // 500 requêtes/heure max
    this.dailyThreshold = options.dailyThreshold || 5000;    // 5000 requêtes/jour max
    this.uniqueDomainsThreshold = options.uniqueDomainsThreshold || 100; // 100 domaines uniques/heure

    // Tracking par IP
    this.ipTracking = new Map(); // IP -> { hourly, daily, domains, firstSeen, lastSeen }

    // Statistiques
    this.stats = {
      trackedIPs: 0,
      suspiciousDetected: 0,
      totalRequests: 0
    };

    // Nettoyage automatique toutes les heures
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 3600000); // 1 heure
  }

  /**
   * Enregistre une requête et détecte si le comportement est suspect
   * @param {string} clientIP
   * @param {string} hostname
   * @returns {object} { suspicious: boolean, reason: string, severity: string }
   */
  trackRequest(clientIP, hostname) {
    if (!clientIP || clientIP === 'unknown') {
      return { suspicious: false };
    }

    this.stats.totalRequests++;

    const now = Date.now();
    const oneHourAgo = now - 3600000;   // 1 heure
    const oneDayAgo = now - 86400000;   // 24 heures

    // Récupérer ou créer l'entrée pour cette IP
    let entry = this.ipTracking.get(clientIP);

    if (!entry) {
      entry = {
        hourly: [],     // Timestamps des requêtes de la dernière heure
        daily: [],      // Timestamps des requêtes des dernières 24h
        domains: new Map(), // domaine -> count pour l'heure
        firstSeen: now,
        lastSeen: now
      };
      this.ipTracking.set(clientIP, entry);
      this.stats.trackedIPs++;
    }

    // Mettre à jour lastSeen
    entry.lastSeen = now;

    // Ajouter la requête
    entry.hourly.push(now);
    entry.daily.push(now);

    // Nettoyer les vieilles entrées
    entry.hourly = entry.hourly.filter(t => t > oneHourAgo);
    entry.daily = entry.daily.filter(t => t > oneDayAgo);

    // Tracker le domaine
    entry.domains.set(hostname, (entry.domains.get(hostname) || 0) + 1);

    // Nettoyer les domaines de plus d'une heure
    const domainsToDelete = [];
    for (const [domain, count] of entry.domains.entries()) {
      // Simplification: on garde les domaines de l'heure actuelle
      // Dans une vraie implémentation, on trackrait le timestamp par domaine
    }

    // Analyser le comportement
    const analysis = this.analyzeBehavior(entry, clientIP, hostname);

    return analysis;
  }

  /**
   * Analyse le comportement d'une IP
   * @param {object} entry
   * @param {string} clientIP
   * @param {string} hostname
   * @returns {object}
   */
  analyzeBehavior(entry, clientIP, hostname) {
    const reasons = [];
    let severity = 'low';

    // 1. Trop de requêtes par heure
    if (entry.hourly.length > this.hourlyThreshold) {
      reasons.push(`Trop de requêtes/heure (${entry.hourly.length}/${this.hourlyThreshold})`);
      severity = 'high';
    }

    // 2. Trop de requêtes par jour
    if (entry.daily.length > this.dailyThreshold) {
      reasons.push(`Trop de requêtes/jour (${entry.daily.length}/${this.dailyThreshold})`);
      severity = 'high';
    }

    // 3. Trop de domaines uniques (scanning)
    const uniqueDomains = entry.domains.size;
    if (uniqueDomains > this.uniqueDomainsThreshold) {
      reasons.push(`Scanning détecté (${uniqueDomains} domaines uniques)`);
      severity = severity === 'high' ? 'critical' : 'medium';
    }

    // 4. Requêtes très rapides (< 100ms entre requêtes)
    if (entry.hourly.length >= 10) {
      const recentRequests = entry.hourly.slice(-10);
      const intervals = [];

      for (let i = 1; i < recentRequests.length; i++) {
        intervals.push(recentRequests[i] - recentRequests[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      if (avgInterval < 100) { // < 100ms = bot
        reasons.push(`Bot détecté (intervalle moyen: ${avgInterval.toFixed(0)}ms)`);
        severity = 'critical';
      }
    }

    // 5. Accès à un domaine unique de manière répétée (> 50 fois)
    for (const [domain, count] of entry.domains.entries()) {
      if (count > 50) {
        reasons.push(`Accès répété à ${domain} (${count} fois)`);
        severity = severity === 'critical' ? 'critical' : 'medium';
      }
    }

    const suspicious = reasons.length > 0;

    if (suspicious) {
      this.stats.suspiciousDetected++;
      logger.warn(`⚠️ Comportement suspect détecté pour ${clientIP}: ${reasons.join(', ')} (sévérité: ${severity})`);
    }

    return {
      suspicious,
      reasons,
      severity,
      hourlyRequests: entry.hourly.length,
      dailyRequests: entry.daily.length,
      uniqueDomains: entry.domains.size
    };
  }

  /**
   * Obtient les informations sur une IP
   * @param {string} clientIP
   * @returns {object|null}
   */
  getIPInfo(clientIP) {
    const entry = this.ipTracking.get(clientIP);
    if (!entry) return null;

    return {
      firstSeen: new Date(entry.firstSeen).toISOString(),
      lastSeen: new Date(entry.lastSeen).toISOString(),
      hourlyRequests: entry.hourly.length,
      dailyRequests: entry.daily.length,
      uniqueDomains: entry.domains.size,
      topDomains: Array.from(entry.domains.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }))
    };
  }

  /**
   * Obtient les IPs les plus actives
   * @param {number} limit
   * @returns {Array}
   */
  getTopIPs(limit = 10) {
    const ips = Array.from(this.ipTracking.entries())
      .map(([ip, entry]) => ({
        ip,
        hourlyRequests: entry.hourly.length,
        dailyRequests: entry.daily.length,
        uniqueDomains: entry.domains.size
      }))
      .sort((a, b) => b.dailyRequests - a.dailyRequests)
      .slice(0, limit);

    return ips;
  }

  /**
   * Nettoie les anciennes entrées
   */
  cleanup() {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    let cleaned = 0;

    for (const [ip, entry] of this.ipTracking.entries()) {
      // Supprimer les IPs inactives depuis plus de 24h
      if (entry.lastSeen < oneDayAgo) {
        this.ipTracking.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Behavior Analyzer: ${cleaned} IPs inactives nettoyées (${this.ipTracking.size} actives)`);
      this.stats.trackedIPs = this.ipTracking.size;
    }
  }

  /**
   * Obtient les statistiques
   * @returns {object}
   */
  getStats() {
    return {
      trackedIPs: this.ipTracking.size,
      suspiciousDetected: this.stats.suspiciousDetected,
      totalRequests: this.stats.totalRequests,
      thresholds: {
        hourly: this.hourlyThreshold,
        daily: this.dailyThreshold,
        uniqueDomains: this.uniqueDomainsThreshold
      }
    };
  }

  /**
   * Réinitialise les données d'une IP
   * @param {string} clientIP
   */
  resetIP(clientIP) {
    if (this.ipTracking.has(clientIP)) {
      this.ipTracking.delete(clientIP);
      logger.info(`Behavior Analyzer: IP ${clientIP} réinitialisée`);
    }
  }

  /**
   * Libère les ressources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Behavior Analyzer: Interval de nettoyage arrêté');
    }
  }
}

module.exports = BehaviorAnalyzer;
