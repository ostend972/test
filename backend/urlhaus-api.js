const https = require('https');
const logger = require('./logger');

/**
 * Client pour URLhaus API (abuse.ch)
 * API gratuite pour vérifier en temps réel si un domaine/URL est malveillant
 * Docs: https://urlhaus-api.abuse.ch/
 */
class URLhausAPI {
  constructor() {
    this.baseURL = 'https://urlhaus-api.abuse.ch/v1';
    this.cache = new Map(); // Cache pour éviter requêtes répétées
    this.cacheTimeout = 3600000; // 1 heure
    this.MAX_CACHE_SIZE = 10000; // Limite de 10 000 entrées
    this.stats = {
      requests: 0,
      cacheHits: 0,
      maliciousFound: 0,
      errors: 0
    };
  }

  /**
   * Vérifie si un domaine est malveillant via l'API URLhaus
   * @param {string} hostname
   * @returns {Promise<object>} { malicious: boolean, threat: string, confidence: string }
   */
  async checkHost(hostname) {
    if (!hostname) {
      return { malicious: false };
    }

    // Vérifier le cache
    const cached = this.cache.get(hostname);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      this.stats.cacheHits++;
      return cached.result;
    }

    this.stats.requests++;

    try {
      const result = await this.queryAPI('host', hostname);

      // Parser la réponse
      const parsedResult = this.parseResponse(result);

      // Mettre en cache avec limite LRU (Least Recently Used)
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // Supprimer la plus ancienne entrée (première clé du Map)
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(hostname, {
        result: parsedResult,
        timestamp: Date.now()
      });

      if (parsedResult.malicious) {
        this.stats.maliciousFound++;
        logger.warn(`URLhaus API: Domaine malveillant détecté: ${hostname} (${parsedResult.threat})`);
      }

      return parsedResult;

    } catch (error) {
      this.stats.errors++;
      logger.error(`URLhaus API erreur pour ${hostname}: ${error.message}`);

      // En cas d'erreur, ne pas bloquer (fail-open)
      return { malicious: false, error: error.message };
    }
  }

  /**
   * Interroge l'API URLhaus
   * @param {string} endpoint - 'host' ou 'url'
   * @param {string} value - hostname ou URL
   * @returns {Promise<object>}
   */
  async queryAPI(endpoint, value) {
    return new Promise((resolve, reject) => {
      const postData = endpoint === 'host'
        ? `host=${encodeURIComponent(value)}`
        : `url=${encodeURIComponent(value)}`;

      const options = {
        hostname: 'urlhaus-api.abuse.ch',
        port: 443,
        path: `/v1/${endpoint}/`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000 // 5 secondes max
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
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

      req.write(postData);
      req.end();
    });
  }

  /**
   * Parse la réponse de l'API URLhaus
   * @param {object} response
   * @returns {object}
   */
  parseResponse(response) {
    // Si query_status === 'no_results', le domaine n'est pas dans la DB
    if (response.query_status === 'no_results') {
      return { malicious: false };
    }

    // Si query_status === 'ok', le domaine est dans la DB (malveillant)
    if (response.query_status === 'ok' && response.urls && response.urls.length > 0) {
      // Analyser les URLs pour déterminer le type de menace
      const urls = response.urls;
      const threats = new Set();
      let maxThreatLevel = 0;

      urls.forEach(entry => {
        if (entry.threat) {
          threats.add(entry.threat);
        }
        // URLhaus utilise un threat_level (1-5)
        if (entry.threat_level && parseInt(entry.threat_level) > maxThreatLevel) {
          maxThreatLevel = parseInt(entry.threat_level);
        }
      });

      const threatTypes = Array.from(threats).join(', ');
      const confidence = maxThreatLevel >= 3 ? 'high' : maxThreatLevel >= 2 ? 'medium' : 'low';

      return {
        malicious: true,
        threat: threatTypes || 'Malware',
        confidence,
        urlCount: urls.length,
        source: 'URLhaus API (temps réel)'
      };
    }

    // Par défaut, considérer comme non malveillant
    return { malicious: false };
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
      logger.info(`URLhaus API: Cache nettoyé (${cleaned} entrées expirées)`);
    }
  }

  /**
   * Obtient les statistiques
   * @returns {object}
   */
  getStats() {
    return {
      requests: this.stats.requests,
      cacheHits: this.stats.cacheHits,
      cacheSize: this.cache.size,
      maliciousFound: this.stats.maliciousFound,
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
    logger.info('URLhaus API: Cache vidé');
  }
}

module.exports = URLhausAPI;
