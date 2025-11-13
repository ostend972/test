const https = require('https');
const logger = require('./logger');

/**
 * Géo-blocker pour bloquer le trafic par pays
 * Utilise l'API gratuite ip-api.com (45 req/min)
 */
class GeoBlocker {
  constructor(blockedCountries = []) {
    this.blockedCountries = new Set(blockedCountries.map(c => c.toUpperCase()));
    this.cache = new Map(); // Cache IP -> pays
    this.cacheTimeout = 86400000; // 24 heures
    this.stats = {
      requests: 0,
      cacheHits: 0,
      blocked: 0,
      errors: 0
    };

    // Pays à haut risque par défaut (optionnel)
    this.highRiskCountries = new Set([
      'CN',  // Chine
      'RU',  // Russie
      'KP',  // Corée du Nord
      'IR',  // Iran
      'SY',  // Syrie
      'CU',  // Cuba
      'SD',  // Soudan
      'BY'   // Biélorussie
    ]);
  }

  /**
   * Ajoute un pays à la liste de blocage
   * @param {string} countryCode - Code pays ISO 3166-1 alpha-2 (ex: 'FR', 'US')
   */
  addCountry(countryCode) {
    this.blockedCountries.add(countryCode.toUpperCase());
    logger.info(`Géo-blocking: Pays ajouté: ${countryCode}`);
  }

  /**
   * Retire un pays de la liste de blocage
   * @param {string} countryCode
   */
  removeCountry(countryCode) {
    this.blockedCountries.delete(countryCode.toUpperCase());
    logger.info(`Géo-blocking: Pays retiré: ${countryCode}`);
  }

  /**
   * Obtient la liste des pays bloqués
   * @returns {Array}
   */
  getBlockedCountries() {
    return Array.from(this.blockedCountries);
  }

  /**
   * Vérifie si une IP doit être bloquée
   * @param {string} ip
   * @returns {Promise<object>} { blocked: boolean, country: string, reason: string }
   */
  async checkIP(ip) {
    if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      // IPs locales/privées ne sont jamais bloquées
      return { blocked: false };
    }

    // Vérifier le cache
    const cached = this.cache.get(ip);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      this.stats.cacheHits++;
      return cached.result;
    }

    this.stats.requests++;

    try {
      const geoData = await this.lookupIP(ip);

      const result = {
        blocked: this.blockedCountries.has(geoData.countryCode),
        country: geoData.country,
        countryCode: geoData.countryCode,
        city: geoData.city,
        reason: this.blockedCountries.has(geoData.countryCode)
          ? `Géo-blocking: Trafic bloqué depuis ${geoData.country}`
          : null
      };

      // Mettre en cache
      this.cache.set(ip, {
        result,
        timestamp: Date.now()
      });

      if (result.blocked) {
        this.stats.blocked++;
        logger.warn(`Géo-blocking: IP ${ip} bloquée (${geoData.country})`);
      }

      return result;

    } catch (error) {
      this.stats.errors++;
      logger.error(`Géo-blocker erreur pour ${ip}: ${error.message}`);

      // En cas d'erreur, ne pas bloquer (fail-open)
      return { blocked: false, error: error.message };
    }
  }

  /**
   * Interroge l'API de géolocalisation
   * @param {string} ip
   * @returns {Promise<object>}
   */
  async lookupIP(ip) {
    return new Promise((resolve, reject) => {
      const url = `https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city`;

      const req = https.get(url, { timeout: 5000 }, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (parsed.status === 'fail') {
              return reject(new Error(parsed.message || 'Lookup failed'));
            }

            resolve({
              country: parsed.country || 'Unknown',
              countryCode: parsed.countryCode || 'XX',
              city: parsed.city || 'Unknown'
            });

          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Nettoie le cache des entrées expirées
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Géo-blocker: Cache nettoyé (${cleaned} entrées expirées)`);
    }
  }

  /**
   * Obtient les statistiques
   * @returns {object}
   */
  getStats() {
    return {
      blockedCountries: Array.from(this.blockedCountries),
      requests: this.stats.requests,
      cacheHits: this.stats.cacheHits,
      cacheSize: this.cache.size,
      blocked: this.stats.blocked,
      errors: this.stats.errors,
      cacheHitRate: this.stats.requests > 0
        ? ((this.stats.cacheHits / (this.stats.requests + this.stats.cacheHits)) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Géo-blocker: Cache vidé');
  }
}

module.exports = GeoBlocker;
