/**
 * Tests unitaires pour Géo-Blocking
 * Filtrage géographique par pays
 */

const GeoBlocker = require('../geo-blocker');

describe('Géo-Blocker', () => {
  let geoBlocker;

  beforeEach(() => {
    geoBlocker = new GeoBlocker(['CN', 'RU', 'KP']);
  });

  describe('Initialisation', () => {
    test('devrait initialiser avec les pays bloqués', () => {
      expect(geoBlocker.blockedCountries.has('CN')).toBe(true);
      expect(geoBlocker.blockedCountries.has('RU')).toBe(true);
      expect(geoBlocker.blockedCountries.has('KP')).toBe(true);
      expect(geoBlocker.blockedCountries.size).toBe(3);
    });

    test('devrait normaliser les codes pays en majuscules', () => {
      const gb = new GeoBlocker(['cn', 'ru']);
      expect(gb.blockedCountries.has('CN')).toBe(true);
      expect(gb.blockedCountries.has('RU')).toBe(true);
    });

    test('devrait gérer une liste vide', () => {
      const gb = new GeoBlocker([]);
      expect(gb.blockedCountries.size).toBe(0);
    });

    test('devrait avoir un cache vide au démarrage', () => {
      expect(geoBlocker.cache.size).toBe(0);
    });

    test('devrait avoir le bon timeout de cache (24h)', () => {
      expect(geoBlocker.cacheTimeout).toBe(86400000);
    });
  });

  describe('Gestion des Pays', () => {
    test('devrait ajouter un pays', () => {
      geoBlocker.addCountry('IR');
      expect(geoBlocker.blockedCountries.has('IR')).toBe(true);
      expect(geoBlocker.blockedCountries.size).toBe(4);
    });

    test('devrait normaliser le code lors de l\'ajout', () => {
      geoBlocker.addCountry('ir');
      expect(geoBlocker.blockedCountries.has('IR')).toBe(true);
    });

    test('ne devrait pas ajouter de doublons', () => {
      geoBlocker.addCountry('CN'); // Déjà présent
      expect(geoBlocker.blockedCountries.size).toBe(3);
    });

    test('devrait retirer un pays', () => {
      geoBlocker.removeCountry('CN');
      expect(geoBlocker.blockedCountries.has('CN')).toBe(false);
      expect(geoBlocker.blockedCountries.size).toBe(2);
    });

    test('devrait normaliser le code lors du retrait', () => {
      geoBlocker.removeCountry('cn');
      expect(geoBlocker.blockedCountries.has('CN')).toBe(false);
    });

    test('ne devrait pas planter en retirant un pays inexistant', () => {
      expect(() => geoBlocker.removeCountry('XX')).not.toThrow();
    });

    test('devrait obtenir la liste des pays bloqués', () => {
      const countries = geoBlocker.getBlockedCountries();
      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBe(3);
      expect(countries).toContain('CN');
      expect(countries).toContain('RU');
      expect(countries).toContain('KP');
    });
  });

  describe('Validation des IPs', () => {
    test('ne devrait jamais bloquer les IPs locales', async () => {
      const localIPs = [
        '127.0.0.1',
        '127.0.0.2',
        '192.168.1.1',
        '192.168.0.100',
        '10.0.0.1',
        '10.255.255.255'
      ];

      for (const ip of localIPs) {
        const result = await geoBlocker.checkIP(ip);
        expect(result.blocked).toBe(false);
      }
    });

    test('ne devrait pas bloquer les IPs null ou undefined', async () => {
      const result1 = await geoBlocker.checkIP(null);
      const result2 = await geoBlocker.checkIP(undefined);
      const result3 = await geoBlocker.checkIP('');

      expect(result1.blocked).toBe(false);
      expect(result2.blocked).toBe(false);
      expect(result3.blocked).toBe(false);
    });

    test('ne devrait pas bloquer "unknown"', async () => {
      const result = await geoBlocker.checkIP('unknown');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Cache', () => {
    test('devrait mettre en cache les résultats', () => {
      const ip = '1.2.3.4';
      const result = {
        blocked: true,
        country: 'China',
        countryCode: 'CN',
        reason: 'Géo-blocking: Trafic bloqué depuis China'
      };

      geoBlocker.cache.set(ip, {
        result,
        timestamp: Date.now()
      });

      expect(geoBlocker.cache.has(ip)).toBe(true);
      expect(geoBlocker.cache.get(ip).result).toEqual(result);
    });

    test('devrait nettoyer les entrées expirées', () => {
      const old = Date.now() - 90000000; // 25 heures
      const recent = Date.now();

      geoBlocker.cache.set('1.2.3.4', {
        result: {},
        timestamp: old
      });
      geoBlocker.cache.set('5.6.7.8', {
        result: {},
        timestamp: recent
      });

      geoBlocker.cleanupCache();

      expect(geoBlocker.cache.has('1.2.3.4')).toBe(false);
      expect(geoBlocker.cache.has('5.6.7.8')).toBe(true);
    });

    test('devrait vider complètement le cache', () => {
      geoBlocker.cache.set('1.2.3.4', { result: {}, timestamp: Date.now() });
      geoBlocker.cache.set('5.6.7.8', { result: {}, timestamp: Date.now() });

      expect(geoBlocker.cache.size).toBe(2);

      geoBlocker.clearCache();

      expect(geoBlocker.cache.size).toBe(0);
    });
  });

  describe('Statistiques', () => {
    test('devrait retourner les statistiques initiales', () => {
      const stats = geoBlocker.getStats();

      expect(stats).toHaveProperty('requests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('blocked');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('blockedCountries');

      expect(stats.requests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.blocked).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHitRate).toBe('0%');
      expect(stats.blockedCountries).toEqual(['CN', 'RU', 'KP']);
    });

    test('devrait calculer le cache hit rate', () => {
      geoBlocker.requests = 100;
      geoBlocker.cacheHits = 92;

      const stats = geoBlocker.getStats();

      expect(stats.cacheHitRate).toBe('92.00%');
    });

    test('devrait gérer la division par zéro', () => {
      geoBlocker.requests = 0;
      geoBlocker.cacheHits = 0;

      const stats = geoBlocker.getStats();

      expect(stats.cacheHitRate).toBe('0%');
    });
  });

  describe('Parse Geo Data', () => {
    test('devrait parser les données GeoIP valides', () => {
      const apiResponse = {
        status: 'success',
        country: 'China',
        countryCode: 'CN',
        city: 'Beijing'
      };

      const result = geoBlocker.parseGeoData(apiResponse);

      expect(result.country).toBe('China');
      expect(result.countryCode).toBe('CN');
      expect(result.city).toBe('Beijing');
    });

    test('devrait gérer les erreurs API', () => {
      const apiResponse = {
        status: 'fail',
        message: 'invalid query'
      };

      const result = geoBlocker.parseGeoData(apiResponse);

      expect(result.country).toBe('Unknown');
      expect(result.countryCode).toBe('XX');
    });

    test('devrait gérer les données manquantes', () => {
      const apiResponse = {
        status: 'success'
        // Pas de country ou countryCode
      };

      const result = geoBlocker.parseGeoData(apiResponse);

      expect(result.country).toBe('Unknown');
      expect(result.countryCode).toBe('XX');
    });
  });

  describe('Blocage', () => {
    test('devrait bloquer un pays dans la liste', () => {
      const geoData = {
        country: 'China',
        countryCode: 'CN'
      };

      const isBlocked = geoBlocker.shouldBlock(geoData);

      expect(isBlocked).toBe(true);
    });

    test('ne devrait pas bloquer un pays non listé', () => {
      const geoData = {
        country: 'France',
        countryCode: 'FR'
      };

      const isBlocked = geoBlocker.shouldBlock(geoData);

      expect(isBlocked).toBe(false);
    });

    test('ne devrait pas bloquer Unknown', () => {
      const geoData = {
        country: 'Unknown',
        countryCode: 'XX'
      };

      const isBlocked = geoBlocker.shouldBlock(geoData);

      expect(isBlocked).toBe(false);
    });
  });
});
