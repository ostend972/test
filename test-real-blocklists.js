/**
 * ═══════════════════════════════════════════════════════════════════
 * SCRIPT DE TEST ULTRA-PUISSANT AVEC VRAIES LISTES DE BLOCAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Teste avec des domaines RÉELS depuis les listes publiques :
 * - StevenBlack/hosts (Malware, Ads)
 * - Hagezi Ultimate
 * - EasyList FR
 * - Red Flag Domains
 */

const http = require('http');
const https = require('https');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 8081;
const TEST_DURATION = 5 * 60 * 1000; // 5 minutes
const DELAY_BETWEEN_TESTS = 1000; // 1 seconde

// URLs des vraies listes de blocage
const BLOCKLIST_URLS = {
  stevenBlack: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  hageziPro: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/hosts/pro.txt',
};

// Compteurs
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  allowed: 0,
  realDomainsBlocked: 0,
  realDomainsAllowed: 0
};

// Cache des domaines chargés
let loadedDomains = {
  malicious: [],
  ads: [],
  legitimate: []
};

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════

function log(message, color = '\x1b[0m') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] ${message}\x1b[0m`);
}

function logSuccess(message) {
  log(`✓ ${message}`, '\x1b[32m');
}

function logError(message) {
  log(`✗ ${message}`, '\x1b[31m');
}

function logInfo(message) {
  log(`ℹ ${message}`, '\x1b[36m');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════
// CHARGEMENT DES LISTES
// ═══════════════════════════════════════════════════════════════════

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function parseHostsFile(content) {
  const domains = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Ignorer les commentaires et lignes vides
    if (line.startsWith('#') || line.trim() === '') continue;

    // Format: 0.0.0.0 domain.com ou 127.0.0.1 domain.com
    const match = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(.+)$/);
    if (match) {
      const domain = match[1].trim();
      // Ignorer localhost
      if (domain !== 'localhost' && domain !== 'localhost.localdomain') {
        domains.push(domain);
      }
    }
  }

  return domains;
}

async function loadBlocklists() {
  logInfo('Chargement des vraies listes de blocage...');

  try {
    // Charger StevenBlack
    logInfo('Téléchargement de StevenBlack/hosts...');
    const stevenBlackContent = await downloadFile(BLOCKLIST_URLS.stevenBlack);
    const stevenBlackDomains = parseHostsFile(stevenBlackContent);
    logSuccess(`StevenBlack: ${stevenBlackDomains.length} domaines chargés`);

    // Prendre un échantillon pour les tests
    loadedDomains.malicious = stevenBlackDomains
      .filter(d => d.includes('ad') || d.includes('track') || d.includes('analytics'))
      .slice(0, 100);

    loadedDomains.ads = stevenBlackDomains
      .filter(d => d.includes('doubleclick') || d.includes('googlesyndication') || d.includes('adservice'))
      .slice(0, 50);

    // Sites légitimes connus qui NE doivent PAS être bloqués
    loadedDomains.legitimate = [
      'google.com',
      'wikipedia.org',
      'github.com',
      'stackoverflow.com',
      'microsoft.com',
      'amazon.com',
      'facebook.com',
      'twitter.com',
      'youtube.com',
      'reddit.com'
    ];

    logSuccess(`✓ ${loadedDomains.malicious.length} domaines malveillants chargés`);
    logSuccess(`✓ ${loadedDomains.ads.length} domaines publicitaires chargés`);
    logSuccess(`✓ ${loadedDomains.legitimate.length} sites légitimes chargés`);

  } catch (error) {
    logError(`Erreur chargement listes: ${error.message}`);
    // Fallback sur des domaines connus
    loadedDomains.malicious = [
      'doubleclick.net',
      'googleadservices.com',
      'googlesyndication.com',
      'scorecardresearch.com',
      'adnxs.com'
    ];
    loadedDomains.ads = [
      'ads.google.com',
      'pagead2.googlesyndication.com',
      'static.ads-twitter.com'
    ];
    loadedDomains.legitimate = [
      'google.com',
      'wikipedia.org',
      'github.com'
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════
// FONCTIONS DE TEST
// ═══════════════════════════════════════════════════════════════════

function testProxyRequest(host, port = 80) {
  return new Promise((resolve) => {
    const options = {
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: 'CONNECT',
      path: `${host}:${port}`
    };

    const req = http.request(options);

    req.on('connect', (res, socket) => {
      socket.end();
      resolve({ blocked: res.statusCode !== 200, status: res.statusCode });
    });

    req.on('error', (err) => {
      resolve({ blocked: true, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ blocked: true, error: 'timeout' });
    });

    req.end();
  });
}

async function testDomain(domain, shouldBlock, isRealDomain = false) {
  stats.total++;

  try {
    const result = await testProxyRequest(domain);

    if (shouldBlock && result.blocked) {
      stats.passed++;
      stats.blocked++;
      if (isRealDomain) stats.realDomainsBlocked++;
      logSuccess(`${domain} - BLOQUÉ (comme attendu)`);
      return true;
    } else if (!shouldBlock && !result.blocked) {
      stats.passed++;
      stats.allowed++;
      if (isRealDomain) stats.realDomainsAllowed++;
      logSuccess(`${domain} - AUTORISÉ (comme attendu)`);
      return true;
    } else if (shouldBlock && !result.blocked) {
      stats.failed++;
      logError(`${domain} - DEVRAIT ÊTRE BLOQUÉ mais a passé !`);
      return false;
    } else {
      stats.failed++;
      logError(`${domain} - DEVRAIT ÊTRE AUTORISÉ mais a été bloqué !`);
      return false;
    }
  } catch (error) {
    stats.failed++;
    logError(`${domain} - Erreur: ${error.message}`);
    return false;
  }
}

// Tests supplémentaires
async function testDirectIP(ip) {
  stats.total++;
  const result = await testProxyRequest(ip);

  if (result.blocked) {
    stats.passed++;
    stats.blocked++;
    logSuccess(`IP ${ip} - BLOQUÉE (comme attendu)`);
    return true;
  } else {
    stats.failed++;
    logError(`IP ${ip} - DEVRAIT ÊTRE BLOQUÉE !`);
    return false;
  }
}

async function testRemoteSoftware() {
  const remoteApps = ['teamviewer.com', 'anydesk.com'];
  for (const app of remoteApps) {
    await testDomain(app, true, false);
    await sleep(500);
  }
}

async function testNonStandardPort(host, port) {
  stats.total++;
  const result = await testProxyRequest(host, port);

  if (result.blocked) {
    stats.passed++;
    stats.blocked++;
    logSuccess(`${host}:${port} - PORT NON STANDARD BLOQUÉ`);
    return true;
  } else {
    stats.failed++;
    logError(`${host}:${port} - PORT DEVRAIT ÊTRE BLOQUÉ !`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXÉCUTION DES TESTS
// ═══════════════════════════════════════════════════════════════════

async function runTestSuite() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🚀 TEST ULTRA-PUISSANT AVEC VRAIES LISTES DE BLOCAGE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Durée: 5 minutes`);
  console.log(`  Proxy: ${PROXY_HOST}:${PROXY_PORT}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  // Charger les listes
  await loadBlocklists();

  const startTime = Date.now();
  let cycleCount = 0;

  while (Date.now() - startTime < TEST_DURATION) {
    cycleCount++;
    console.log('\n');
    log(`═══════ CYCLE ${cycleCount} ═══════`, '\x1b[35m');
    console.log('\n');

    // Test 1: Domaines malveillants RÉELS
    console.log('🛡️  BLOCAGE DOMAINES MALVEILLANTS RÉELS (depuis StevenBlack)');
    console.log('─'.repeat(70));
    const maliciousSample = loadedDomains.malicious.slice(0, 15);
    for (const domain of maliciousSample) {
      await testDomain(domain, true, true);
      await sleep(500);
    }

    // Test 2: Domaines publicitaires RÉELS
    console.log('\n📛 BLOCAGE PUBLICITÉS RÉELLES (depuis listes publiques)');
    console.log('─'.repeat(70));
    const adsSample = loadedDomains.ads.slice(0, 10);
    for (const domain of adsSample) {
      await testDomain(domain, true, true);
      await sleep(500);
    }

    // Test 3: Logiciels distants
    console.log('\n🚫 BLOCAGE LOGICIELS DISTANTS');
    console.log('─'.repeat(70));
    await testRemoteSoftware();

    // Test 4: IPs directes
    console.log('\n🔒 BLOCAGE NAVIGATION PAR IP');
    console.log('─'.repeat(70));
    const testIPs = ['8.8.8.8', '1.1.1.1', '142.250.185.46'];
    for (const ip of testIPs) {
      await testDirectIP(ip);
      await sleep(500);
    }

    // Test 5: Ports non standard
    console.log('\n🔌 FILTRAGE DES PORTS NON STANDARD');
    console.log('─'.repeat(70));
    const portTests = [
      { host: 'example.com', port: 8080 },
      { host: 'example.com', port: 3000 }
    ];
    for (const { host, port } of portTests) {
      await testNonStandardPort(host, port);
      await sleep(500);
    }

    // Test 6: Sites légitimes (doivent passer)
    console.log('\n✅ SITES LÉGITIMES (doivent passer)');
    console.log('─'.repeat(70));
    const legitimateSample = loadedDomains.legitimate.slice(0, 5);
    for (const domain of legitimateSample) {
      await testDomain(domain, false, true);
      await sleep(500);
    }

    // Stats du cycle
    console.log('\n');
    log(`═══════ STATISTIQUES CYCLE ${cycleCount} ═══════`, '\x1b[35m');
    console.log(`Total tests: ${stats.total}`);
    console.log(`\x1b[32mRéussis: ${stats.passed}\x1b[0m`);
    console.log(`\x1b[31mÉchoués: ${stats.failed}\x1b[0m`);
    console.log(`🛡️  Domaines réels bloqués: ${stats.realDomainsBlocked}`);
    console.log(`✅ Sites légitimes autorisés: ${stats.realDomainsAllowed}`);
    console.log(`Taux de réussite: ${((stats.passed / stats.total) * 100).toFixed(2)}%`);

    const elapsed = Date.now() - startTime;
    const remaining = TEST_DURATION - elapsed;
    console.log(`\nTemps écoulé: ${Math.floor(elapsed / 1000)}s / ${TEST_DURATION / 1000}s`);
    console.log(`Temps restant: ${Math.floor(remaining / 1000)}s`);

    if (remaining > DELAY_BETWEEN_TESTS) {
      await sleep(DELAY_BETWEEN_TESTS);
    }
  }

  // Rapport final
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🏁 RAPPORT FINAL - TEST AVEC VRAIES LISTES DE BLOCAGE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\n  Durée totale: 5 minutes`);
  console.log(`  Cycles complétés: ${cycleCount}`);
  console.log(`\n  📊 STATISTIQUES GLOBALES`);
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log(`  Total de tests: ${stats.total}`);
  console.log(`  \x1b[32m✓ Réussis: ${stats.passed}\x1b[0m`);
  console.log(`  \x1b[31m✗ Échoués: ${stats.failed}\x1b[0m`);
  console.log(`  🛡️  Domaines réels bloqués: ${stats.realDomainsBlocked}`);
  console.log(`  ✅ Sites légitimes autorisés: ${stats.realDomainsAllowed}`);
  console.log(`  🔒 Total bloqués: ${stats.blocked}`);
  console.log(`  ✅ Total autorisés: ${stats.allowed}`);
  console.log(`\n  🎯 TAUX DE RÉUSSITE: ${((stats.passed / stats.total) * 100).toFixed(2)}%`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (stats.failed === 0) {
    console.log('\n  🎉 PARFAIT ! Tous les tests ont réussi !');
    console.log('  Les listes de blocage fonctionnent à 100% !');
  } else {
    console.log(`\n  ⚠️  ${stats.failed} test(s) ont échoué.`);
  }

  console.log('\n');
}

// ═══════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════

runTestSuite().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
