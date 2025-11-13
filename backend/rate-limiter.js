const logger = require('./logger');

/**
 * Rate Limiter pour protection DoS
 * Limite le nombre de requêtes par IP sur une fenêtre de temps
 */
class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100; // Max requêtes par fenêtre
    this.windowMs = options.windowMs || 1000; // Fenêtre de temps (1 seconde)
    this.blockDurationMs = options.blockDurationMs || 60000; // Durée de blocage (1 minute)

    // Map: IP -> { count, firstRequest, blocked, blockedUntil }
    this.requests = new Map();

    // Statistiques
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueIPs: new Set()
    };

    // Nettoyage périodique des anciennes entrées
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Nettoyer toutes les minutes
  }

  /**
   * Vérifie si une requête depuis une IP est autorisée
   * @param {string} ip - Adresse IP du client
   * @returns {object} { allowed: boolean, retryAfter?: number, reason?: string }
   */
  checkRateLimit(ip) {
    if (!ip) {
      return { allowed: true };
    }

    const now = Date.now();
    this.stats.totalRequests++;
    this.stats.uniqueIPs.add(ip);

    // Récupérer ou créer l'entrée pour cette IP
    let entry = this.requests.get(ip);

    if (!entry) {
      // Première requête de cette IP
      entry = {
        count: 1,
        firstRequest: now,
        blocked: false,
        blockedUntil: null
      };
      this.requests.set(ip, entry);
      return { allowed: true };
    }

    // Vérifier si l'IP est bloquée
    if (entry.blocked && entry.blockedUntil > now) {
      this.stats.blockedRequests++;
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);

      return {
        allowed: false,
        retryAfter,
        reason: `Rate limit dépassé. Réessayez dans ${retryAfter}s.`
      };
    }

    // Si le blocage est expiré, réinitialiser
    if (entry.blocked && entry.blockedUntil <= now) {
      entry.blocked = false;
      entry.blockedUntil = null;
      entry.count = 1;
      entry.firstRequest = now;
      this.requests.set(ip, entry);
      return { allowed: true };
    }

    // Vérifier si la fenêtre de temps est expirée
    const windowExpired = (now - entry.firstRequest) > this.windowMs;

    if (windowExpired) {
      // Nouvelle fenêtre, réinitialiser le compteur
      entry.count = 1;
      entry.firstRequest = now;
      this.requests.set(ip, entry);
      return { allowed: true };
    }

    // Incrémenter le compteur
    entry.count++;
    this.requests.set(ip, entry);

    // Vérifier si le seuil est dépassé
    if (entry.count > this.maxRequests) {
      entry.blocked = true;
      entry.blockedUntil = now + this.blockDurationMs;
      this.requests.set(ip, entry);
      this.stats.blockedRequests++;

      logger.warn(`Rate limit dépassé pour ${ip}: ${entry.count} requêtes en ${this.windowMs}ms`);

      const retryAfter = Math.ceil(this.blockDurationMs / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: `Rate limit dépassé. Bloqué pendant ${retryAfter}s.`
      };
    }

    return { allowed: true };
  }

  /**
   * Nettoie les anciennes entrées expirées
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, entry] of this.requests.entries()) {
      // Supprimer les entrées non bloquées et anciennes
      if (!entry.blocked && (now - entry.firstRequest) > this.windowMs * 2) {
        this.requests.delete(ip);
        cleaned++;
        continue;
      }

      // Supprimer les entrées bloquées expirées
      if (entry.blocked && entry.blockedUntil <= now) {
        this.requests.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Rate limiter: ${cleaned} entrées nettoyées (total actif: ${this.requests.size})`);
    }
  }

  /**
   * Réinitialise le rate limiter pour une IP
   * @param {string} ip
   */
  reset(ip) {
    if (this.requests.has(ip)) {
      this.requests.delete(ip);
      logger.info(`Rate limiter réinitialisé pour ${ip}`);
    }
  }

  /**
   * Obtient les statistiques
   * @returns {object}
   */
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      blockedRequests: this.stats.blockedRequests,
      uniqueIPs: this.stats.uniqueIPs.size,
      activeEntries: this.requests.size,
      blockRate: this.stats.totalRequests > 0
        ? ((this.stats.blockedRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Obtient les IPs bloquées
   * @returns {Array}
   */
  getBlockedIPs() {
    const now = Date.now();
    const blocked = [];

    for (const [ip, entry] of this.requests.entries()) {
      if (entry.blocked && entry.blockedUntil > now) {
        blocked.push({
          ip,
          blockedUntil: new Date(entry.blockedUntil).toISOString(),
          retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
        });
      }
    }

    return blocked;
  }

  /**
   * Libère les ressources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Rate limiter: Interval de nettoyage arrêté');
    }
  }
}

module.exports = RateLimiter;
