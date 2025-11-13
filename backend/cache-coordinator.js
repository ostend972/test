/**
 * Coordinateur de cache global pour CalmWeb
 * Gère le nettoyage et l'optimisation des caches multiples
 */

class CacheCoordinator {
  constructor() {
    this.caches = [];
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 3600000; // 1 heure par défaut
    this.stats = {
      lastCleanup: null,
      totalCleanupsRun: 0,
      totalEntriesCleanedUp: 0,
    };
  }

  /**
   * Enregistre un cache pour la gestion globale
   * @param {string} name - Nom du cache (pour les logs)
   * @param {object} cacheInstance - Instance du cache
   * @param {function} cleanupMethod - Méthode de nettoyage (doit retourner le nombre d'entrées nettoyées)
   */
  registerCache(name, cacheInstance, cleanupMethod) {
    this.caches.push({
      name,
      instance: cacheInstance,
      cleanup: cleanupMethod,
    });
  }

  /**
   * Démarre le nettoyage périodique automatique
   * @param {number} intervalMs - Intervalle de nettoyage en millisecondes (défaut: 1h)
   */
  startPeriodicCleanup(intervalMs = this.cleanupIntervalMs) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.runGlobalCleanup();
    }, intervalMs);

    // Cleanup initial après 5 minutes
    setTimeout(() => {
      this.runGlobalCleanup();
    }, 300000);
  }

  /**
   * Arrête le nettoyage périodique
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Exécute un nettoyage global sur tous les caches enregistrés
   * @returns {object} - Statistiques du nettoyage
   */
  async runGlobalCleanup() {
    const startTime = Date.now();
    const results = [];
    let totalCleaned = 0;

    for (const cache of this.caches) {
      try {
        const cleaned = await cache.cleanup.call(cache.instance);
        const count = typeof cleaned === 'number' ? cleaned : 0;

        results.push({
          cache: cache.name,
          entriesCleaned: count,
          success: true,
        });

        totalCleaned += count;
      } catch (error) {
        results.push({
          cache: cache.name,
          entriesCleaned: 0,
          success: false,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    this.stats.lastCleanup = new Date().toISOString();
    this.stats.totalCleanupsRun++;
    this.stats.totalEntriesCleanedUp += totalCleaned;

    return {
      timestamp: this.stats.lastCleanup,
      duration,
      cachesProcessed: this.caches.length,
      totalEntriesCleaned: totalCleaned,
      results,
    };
  }

  /**
   * Obtient les statistiques de tous les caches
   * @returns {object} - Statistiques globales
   */
  getCacheStats() {
    const cacheStats = {};

    for (const cache of this.caches) {
      try {
        // Tenter d'obtenir des stats si disponibles
        if (typeof cache.instance.getStats === 'function') {
          cacheStats[cache.name] = cache.instance.getStats();
        } else if (cache.instance.cache) {
          // Fallback: compter manuellement si cache est une Map
          cacheStats[cache.name] = {
            entries: cache.instance.cache.size || cache.instance.cache.length || 0,
          };
        } else if (cache.instance.ipTracking) {
          // Behavior Analyzer
          cacheStats[cache.name] = {
            entries: cache.instance.ipTracking.size || 0,
          };
        } else if (cache.instance.whitelistCache) {
          // Whitelist Manager
          cacheStats[cache.name] = {
            entries: cache.instance.whitelistCache.size || 0,
            cacheHitRate: cache.instance.getCacheHitRate ? cache.instance.getCacheHitRate() : 'N/A',
          };
        } else if (cache.instance.blocklistCache) {
          // Blocklist Manager
          cacheStats[cache.name] = {
            entries: cache.instance.blocklistCache.size || 0,
            cacheHitRate: cache.instance.getCacheHitRate ? cache.instance.getCacheHitRate() : 'N/A',
          };
        }
      } catch (error) {
        cacheStats[cache.name] = {
          error: 'Unable to fetch stats',
        };
      }
    }

    return {
      coordinator: this.stats,
      caches: cacheStats,
    };
  }

  /**
   * Calcule l'utilisation mémoire approximative des caches
   * @returns {object} - Estimation de la mémoire utilisée
   */
  getMemoryEstimate() {
    let totalEstimatedBytes = 0;
    const estimates = {};

    for (const cache of this.caches) {
      let estimatedBytes = 0;

      try {
        // Estimation basée sur le nombre d'entrées
        if (cache.instance.cache && cache.instance.cache.size) {
          // Moyenne de 200 bytes par entrée (clé + valeur)
          estimatedBytes = cache.instance.cache.size * 200;
        } else if (cache.instance.ipTracking && cache.instance.ipTracking.size) {
          // Behavior Analyzer: ~500 bytes par IP (historique)
          estimatedBytes = cache.instance.ipTracking.size * 500;
        } else if (cache.instance.whitelistCache) {
          estimatedBytes = cache.instance.whitelistCache.size * 150;
        } else if (cache.instance.blocklistCache) {
          estimatedBytes = cache.instance.blocklistCache.size * 150;
        }

        estimates[cache.name] = {
          bytes: estimatedBytes,
          mb: (estimatedBytes / 1024 / 1024).toFixed(2),
        };

        totalEstimatedBytes += estimatedBytes;
      } catch (error) {
        estimates[cache.name] = { error: 'Unable to estimate' };
      }
    }

    return {
      total: {
        bytes: totalEstimatedBytes,
        mb: (totalEstimatedBytes / 1024 / 1024).toFixed(2),
      },
      byCache: estimates,
    };
  }

  /**
   * Vide tous les caches (à utiliser avec précaution)
   */
  async clearAllCaches() {
    const results = [];

    for (const cache of this.caches) {
      try {
        if (typeof cache.instance.clear === 'function') {
          await cache.instance.clear();
          results.push({ cache: cache.name, success: true });
        } else if (cache.instance.cache && typeof cache.instance.cache.clear === 'function') {
          cache.instance.cache.clear();
          results.push({ cache: cache.name, success: true });
        } else {
          results.push({ cache: cache.name, success: false, reason: 'No clear method' });
        }
      } catch (error) {
        results.push({ cache: cache.name, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = CacheCoordinator;
