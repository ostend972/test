/**
 * Tests unitaires pour URLhaus API
 * Threat Intelligence temps réel
 */

const URLhausAPI = require('../urlhaus-api');

describe('URLhaus API', () => {
  let urlhausAPI;

  beforeEach(() => {
    urlhausAPI = new URLhausAPI();
  });

  describe('Initialisation', () => {
    test('devrait initialiser avec les bonnes valeurs par défaut', () => {
      expect(urlhausAPI.baseURL).toBe('https://urlhaus-api.abuse.ch/v1');
      expect(urlhausAPI.cache).toBeInstanceOf(Map);
      expect(urlhausAPI.cacheTimeout).toBe(3600000); // 1 heure
    });

    test('devrait avoir un cache vide au démarrage', () => {
      expect(urlhausAPI.cache.size).toBe(0);
    });
  });

  describe('Parse Response', () => {
    test('devrait retourner malicious: false pour no_results', () => {
      const response = { query_status: 'no_results' };
      const result = urlhausAPI.parseResponse(response);

      expect(result.malicious).toBe(false);
    });

    test('devrait détecter un domaine malveillant', () => {
      const response = {
        query_status: 'ok',
        urls: [
          { threat: 'malware_download', threat_level: '4' },
          { threat: 'ransomware', threat_level: '5' }
        ]
      };
      const result = urlhausAPI.parseResponse(response);

      expect(result.malicious).toBe(true);
      expect(result.threat).toContain('malware_download');
      expect(result.threat).toContain('ransomware');
      expect(result.confidence).toBe('high');
      expect(result.urlCount).toBe(2);
      expect(result.source).toBe('URLhaus API (temps réel)');
    });

    test('devrait gérer les niveaux de confiance', () => {
      const highThreat = {
        query_status: 'ok',
        urls: [{ threat: 'test', threat_level: '4' }]
      };
      const mediumThreat = {
        query_status: 'ok',
        urls: [{ threat: 'test', threat_level: '2' }]
      };
      const lowThreat = {
        query_status: 'ok',
        urls: [{ threat: 'test', threat_level: '1' }]
      };

      expect(urlhausAPI.parseResponse(highThreat).confidence).toBe('high');
      expect(urlhausAPI.parseResponse(mediumThreat).confidence).toBe('medium');
      expect(urlhausAPI.parseResponse(lowThreat).confidence).toBe('low');
    });

    test('devrait gérer les menaces multiples', () => {
      const response = {
        query_status: 'ok',
        urls: [
          { threat: 'malware' },
          { threat: 'phishing' },
          { threat: 'malware' } // Duplicate
        ]
      };
      const result = urlhausAPI.parseResponse(response);

      expect(result.malicious).toBe(true);
      // Set devrait dédupliquer
      expect(result.threat.split(', ').length).toBe(2);
    });
  });

  describe('Cache', () => {
    test('devrait mettre en cache les résultats', () => {
      const hostname = 'malware.test';
      const result = { malicious: true, threat: 'malware' };

      urlhausAPI.cache.set(hostname, {
        result,
        timestamp: Date.now()
      });

      expect(urlhausAPI.cache.has(hostname)).toBe(true);
      expect(urlhausAPI.cache.get(hostname).result).toEqual(result);
    });

    test('devrait nettoyer les entrées expirées', () => {
      const old = Date.now() - 7200000; // 2 heures
      const recent = Date.now();

      urlhausAPI.cache.set('old.test', {
        result: {},
        timestamp: old
      });
      urlhausAPI.cache.set('recent.test', {
        result: {},
        timestamp: recent
      });

      urlhausAPI.cleanupCache();

      expect(urlhausAPI.cache.has('old.test')).toBe(false);
      expect(urlhausAPI.cache.has('recent.test')).toBe(true);
    });

    test('devrait vider complètement le cache', () => {
      urlhausAPI.cache.set('test1.com', { result: {}, timestamp: Date.now() });
      urlhausAPI.cache.set('test2.com', { result: {}, timestamp: Date.now() });

      expect(urlhausAPI.cache.size).toBe(2);

      urlhausAPI.clearCache();

      expect(urlhausAPI.cache.size).toBe(0);
    });
  });

  describe('Statistiques', () => {
    test('devrait retourner les statistiques initiales', () => {
      const stats = urlhausAPI.getStats();

      expect(stats).toHaveProperty('requests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('maliciousFound');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cacheHitRate');

      expect(stats.requests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.maliciousFound).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHitRate).toBe('0%');
    });

    test('devrait calculer le cache hit rate', () => {
      urlhausAPI.requests = 100;
      urlhausAPI.cacheHits = 95;

      const stats = urlhausAPI.getStats();

      expect(stats.cacheHitRate).toBe('95.00%');
    });

    test('devrait gérer la division par zéro', () => {
      urlhausAPI.requests = 0;
      urlhausAPI.cacheHits = 0;

      const stats = urlhausAPI.getStats();

      expect(stats.cacheHitRate).toBe('0%');
    });
  });

  describe('Gestion d\'erreurs', () => {
    test('devrait gérer les réponses invalides', () => {
      const invalidResponse = { invalid: 'data' };
      const result = urlhausAPI.parseResponse(invalidResponse);

      expect(result.malicious).toBe(false);
    });

    test('devrait gérer les réponses avec urls null', () => {
      const response = {
        query_status: 'ok',
        urls: null
      };
      const result = urlhausAPI.parseResponse(response);

      expect(result.malicious).toBe(false);
    });

    test('devrait gérer les URLs vides', () => {
      const response = {
        query_status: 'ok',
        urls: []
      };
      const result = urlhausAPI.parseResponse(response);

      expect(result.malicious).toBe(false);
    });
  });
});
