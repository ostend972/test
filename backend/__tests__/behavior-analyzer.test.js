/**
 * Tests unitaires pour Behavior Analyzer
 * Détection de bots, scanning et anomalies
 */

const BehaviorAnalyzer = require('../behavior-analyzer');

describe('Behavior Analyzer', () => {
  let behaviorAnalyzer;

  beforeEach(() => {
    behaviorAnalyzer = new BehaviorAnalyzer({
      hourlyThreshold: 10,
      dailyThreshold: 50,
      uniqueDomainsThreshold: 5
    });
  });

  describe('Initialisation', () => {
    test('devrait initialiser avec les seuils configurés', () => {
      expect(behaviorAnalyzer.hourlyThreshold).toBe(10);
      expect(behaviorAnalyzer.dailyThreshold).toBe(50);
      expect(behaviorAnalyzer.uniqueDomainsThreshold).toBe(5);
    });

    test('devrait utiliser les valeurs par défaut', () => {
      const ba = new BehaviorAnalyzer();
      expect(ba.hourlyThreshold).toBe(500);
      expect(ba.dailyThreshold).toBe(5000);
      expect(ba.uniqueDomainsThreshold).toBe(100);
    });

    test('devrait avoir un tracking vide au démarrage', () => {
      expect(behaviorAnalyzer.ipTracking).toBeInstanceOf(Map);
      expect(behaviorAnalyzer.ipTracking.size).toBe(0);
    });

    test('devrait initialiser un interval de cleanup', () => {
      expect(behaviorAnalyzer.cleanupInterval).toBeDefined();
    });
  });

  describe('Tracking de Requêtes', () => {
    test('devrait tracker une première requête', () => {
      const result = behaviorAnalyzer.trackRequest('1.2.3.4', 'example.com');

      expect(result.suspicious).toBe(false);
      expect(result.hourlyRequests).toBe(1);
      expect(result.dailyRequests).toBe(1);
      expect(result.uniqueDomains).toBe(1);
    });

    test('devrait incrémenter les compteurs', () => {
      behaviorAnalyzer.trackRequest('1.2.3.4', 'example.com');
      behaviorAnalyzer.trackRequest('1.2.3.4', 'test.com');
      const result = behaviorAnalyzer.trackRequest('1.2.3.4', 'another.com');

      expect(result.hourlyRequests).toBe(3);
      expect(result.dailyRequests).toBe(3);
      expect(result.uniqueDomains).toBe(3);
    });

    test('devrait tracker plusieurs domaines', () => {
      const ip = '5.6.7.8';

      for (let i = 0; i < 3; i++) {
        behaviorAnalyzer.trackRequest(ip, `domain${i}.com`);
      }

      const entry = behaviorAnalyzer.ipTracking.get(ip);
      expect(entry.domains.size).toBe(3);
      expect(entry.hourly.length).toBe(3);
    });
  });

  describe('Détection - Trop de requêtes/heure', () => {
    test('devrait détecter un dépassement du seuil horaire', () => {
      const ip = '1.2.3.4';
      const now = Date.now();

      // Simuler 11 requêtes avec intervalles > 100ms
      for (let i = 0; i < 11; i++) {
        const entry = behaviorAnalyzer.ipTracking.get(ip) || {
          hourly: [],
          daily: [],
          domains: new Map(),
          firstSeen: now,
          lastSeen: now
        };
        entry.hourly.push(now + (i * 200));
        entry.daily.push(now + (i * 200));
        entry.domains.set('test.com', i + 1);
        behaviorAnalyzer.ipTracking.set(ip, entry);
      }

      const analysis = behaviorAnalyzer.analyzeBehavior(
        behaviorAnalyzer.ipTracking.get(ip),
        ip,
        'test.com'
      );

      expect(analysis.suspicious).toBe(true);
      expect(analysis.severity).toBe('high');
      expect(analysis.reasons.some(r => r.includes('requêtes/heure'))).toBe(true);
    });
  });

  describe('Détection - Scanning', () => {
    test('devrait détecter un scanning (trop de domaines uniques)', () => {
      const ip = '9.10.11.12';

      for (let i = 0; i < 7; i++) {
        behaviorAnalyzer.trackRequest(ip, `domain${i}.com`);
      }

      const result = behaviorAnalyzer.trackRequest(ip, 'domain7.com');

      expect(result.suspicious).toBe(true);
      expect(result.uniqueDomains).toBeGreaterThan(5);
      expect(result.reasons.some(r => r.includes('Scanning'))).toBe(true);
    });
  });

  describe('Détection - Bot', () => {
    test('devrait détecter un bot (intervalle < 100ms)', () => {
      const ip = '13.14.15.16';
      const now = Date.now();

      // 10 requêtes espacées de 50ms
      for (let i = 0; i < 10; i++) {
        const entry = behaviorAnalyzer.ipTracking.get(ip) || {
          hourly: [],
          daily: [],
          domains: new Map(),
          firstSeen: now,
          lastSeen: now
        };
        entry.hourly.push(now + (i * 50));
        entry.daily.push(now + (i * 50));
        entry.domains.set('test.com', i + 1);
        behaviorAnalyzer.ipTracking.set(ip, entry);
      }

      const analysis = behaviorAnalyzer.analyzeBehavior(
        behaviorAnalyzer.ipTracking.get(ip),
        ip,
        'test.com'
      );

      expect(analysis.suspicious).toBe(true);
      expect(analysis.severity).toBe('critical');
      expect(analysis.reasons.some(r => r.includes('Bot'))).toBe(true);
    });
  });

  describe('Détection - Accès répété', () => {
    test('devrait détecter un accès répété au même domaine', () => {
      const ip = '17.18.19.20';

      for (let i = 0; i < 55; i++) {
        behaviorAnalyzer.trackRequest(ip, 'repeated.com');
      }

      const result = behaviorAnalyzer.trackRequest(ip, 'repeated.com');

      expect(result.suspicious).toBe(true);
      expect(result.reasons.some(r => r.includes('Accès répété'))).toBe(true);
    });
  });

  describe('Niveaux de Sévérité', () => {
    test('devrait retourner critical pour un bot', () => {
      const ip = '1.2.3.4';
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        const entry = behaviorAnalyzer.ipTracking.get(ip) || {
          hourly: [],
          daily: [],
          domains: new Map(),
          firstSeen: now,
          lastSeen: now
        };
        entry.hourly.push(now + (i * 30)); // 30ms = bot
        entry.daily.push(now + (i * 30));
        entry.domains.set('test.com', i + 1);
        behaviorAnalyzer.ipTracking.set(ip, entry);
      }

      const analysis = behaviorAnalyzer.analyzeBehavior(
        behaviorAnalyzer.ipTracking.get(ip),
        ip,
        'test.com'
      );

      expect(analysis.severity).toBe('critical');
    });

    test('devrait retourner medium pour scanning simple', () => {
      const ip = '5.6.7.8';

      for (let i = 0; i < 6; i++) {
        behaviorAnalyzer.trackRequest(ip, `domain${i}.com`);
      }

      const result = behaviorAnalyzer.trackRequest(ip, 'domain6.com');

      expect(result.suspicious).toBe(true);
      expect(result.severity).toBe('medium');
    });
  });

  describe('Gestion des IPs', () => {
    test('devrait obtenir les infos d\'une IP', () => {
      behaviorAnalyzer.trackRequest('1.2.3.4', 'example.com');

      const info = behaviorAnalyzer.getIPInfo('1.2.3.4');

      expect(info).toBeDefined();
      expect(info.hourlyRequests).toBe(1);
      expect(info.dailyRequests).toBe(1);
      expect(info.uniqueDomains).toBe(1);
      expect(info.firstSeen).toBeDefined();
      expect(info.lastSeen).toBeDefined();
      expect(Array.isArray(info.topDomains)).toBe(true);
    });

    test('devrait retourner null pour une IP inconnue', () => {
      const info = behaviorAnalyzer.getIPInfo('9.9.9.9');
      expect(info).toBeNull();
    });

    test('devrait réinitialiser une IP', () => {
      behaviorAnalyzer.trackRequest('1.2.3.4', 'example.com');
      expect(behaviorAnalyzer.ipTracking.has('1.2.3.4')).toBe(true);

      behaviorAnalyzer.resetIP('1.2.3.4');
      expect(behaviorAnalyzer.ipTracking.has('1.2.3.4')).toBe(false);
    });

    test('devrait obtenir les top IPs', () => {
      behaviorAnalyzer.trackRequest('1.1.1.1', 'test.com');
      behaviorAnalyzer.trackRequest('2.2.2.2', 'test.com');
      behaviorAnalyzer.trackRequest('2.2.2.2', 'test.com');

      const topIPs = behaviorAnalyzer.getTopIPs(2);

      expect(Array.isArray(topIPs)).toBe(true);
      expect(topIPs.length).toBeLessThanOrEqual(2);
      if (topIPs.length > 1) {
        expect(topIPs[0].dailyRequests).toBeGreaterThanOrEqual(topIPs[1].dailyRequests);
      }
    });
  });

  describe('Cleanup', () => {
    test('devrait nettoyer les IPs inactives', () => {
      const now = Date.now();
      const old = now - 90000000; // 25 heures

      behaviorAnalyzer.ipTracking.set('old.ip', {
        hourly: [],
        daily: [],
        domains: new Map(),
        firstSeen: old,
        lastSeen: old
      });

      behaviorAnalyzer.ipTracking.set('recent.ip', {
        hourly: [],
        daily: [],
        domains: new Map(),
        firstSeen: now,
        lastSeen: now
      });

      const sizeBefore = behaviorAnalyzer.ipTracking.size;
      behaviorAnalyzer.cleanup();
      const sizeAfter = behaviorAnalyzer.ipTracking.size;

      expect(sizeAfter).toBeLessThan(sizeBefore);
      expect(behaviorAnalyzer.ipTracking.has('old.ip')).toBe(false);
      expect(behaviorAnalyzer.ipTracking.has('recent.ip')).toBe(true);
    });
  });

  describe('Statistiques', () => {
    test('devrait retourner les statistiques', () => {
      behaviorAnalyzer.trackRequest('1.2.3.4', 'example.com');
      behaviorAnalyzer.trackRequest('5.6.7.8', 'test.com');

      const stats = behaviorAnalyzer.getStats();

      expect(stats).toHaveProperty('trackedIPs');
      expect(stats).toHaveProperty('suspiciousDetected');
      expect(stats).toHaveProperty('totalRequests');

      expect(stats.trackedIPs).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe('Destroy', () => {
    test('devrait arrêter l\'interval de cleanup', () => {
      expect(behaviorAnalyzer.cleanupInterval).toBeDefined();

      behaviorAnalyzer.destroy();

      expect(behaviorAnalyzer.cleanupInterval).toBeNull();
    });
  });
});
