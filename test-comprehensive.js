/**
 * ═══════════════════════════════════════════════════════════════════
 * SCRIPT DE TEST ULTRA-PUISSANT - CALMWEB
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ce script teste pendant 5 minutes toutes les fonctionnalités de protection :
 * ✓ Blocage sites malveillants & phishing
 * ✓ Blocage publicités
 * ✓ Blocage logiciels distants (TeamViewer, AnyDesk)
 * ✓ Blocage navigation par IP
 * ✓ Force HTTPS
 * ✓ Filtrage des ports
 */

const http = require('http');
const https = require('https');
const dns = require('dns').promises;

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 8081;
const TEST_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes
const DELAY_BETWEEN_TESTS = 2000; // 2 secondes entre chaque test

// Compteurs de résultats
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  allowed: 0
};

// ═══════════════════════════════════════════════════════════════════
// LISTES DE TEST
// ═══════════════════════════════════════════════════════════════════

const TEST_SUITES = {
  malicious: {
    name: '🛡️  BLOCAGE SITES MALVEILLANTS & PHISHING',
    sites: [
      'phishing-test.example.com',
      'malware-test.example.com',
      'doubleclick.net',
      'googleadservices.com',
      'googlesyndication.com',
      'scorecardresearch.com',
      'adnxs.com',
      'advertising.com'
    ],
    shouldBlock: true
  },

  ads: {
    name: '📛 BLOCAGE PUBLICITÉS',
    sites: [
      'ads.example.com',
      'tracker.example.com',
      'analytics.example.com',
      'pagead2.googlesyndication.com',
      'adservice.google.com',
      'static.ads-twitter.com',
      'ads.youtube.com',
      'ads.reddit.com'
    ],
    shouldBlock: true
  },

  remote: {
    name: '🚫 BLOCAGE LOGICIELS DISTANTS',
    sites: [
      'teamviewer.com',
      'anydesk.com',
      'download.teamviewer.com',
      'download.anydesk.com',
      'api.teamviewer.com',
      'api.anydesk.com'
    ],
    shouldBlock: true
  },

  directIP: {
    name: '🔒 BLOCAGE NAVIGATION PAR IP',
    ips: [
      '8.8.8.8',
      '1.1.1.1',
      '142.250.185.46', // IP Google
      '104.244.42.1'    // IP Twitter
    ],
    shouldBlock: true
  },

  httpVsHttps: {
    name: '🔐 FORCE HTTPS (Blocage HTTP)',
    http: [
      'http://example.com',
      'http://test.com',
      'http://insecure.example.com'
    ],
    shouldBlock: true
  },

  portFiltering: {
    name: '🔌 FILTRAGE DES PORTS',
    nonStandardPorts: [
      { host: 'example.com', port: 8080 },
      { host: 'example.com', port: 3000 },
      { host: 'example.com', port: 5000 },
      { host: 'example.com', port: 9000 }
    ],
    shouldBlock: true
  },

  legitimate: {
    name: '✅ SITES LÉGITIMES (doivent passer)',
    sites: [
      'google.com',
      'wikipedia.org',
      'github.com',
      'stackoverflow.com'
    ],
    shouldBlock: false
  }
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

function logWarning(message) {
  log(`⚠ ${message}`, '\x1b[33m');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════
// FONCTIONS DE TEST
// ═══════════════════════════════════════════════════════════════════

/**
 * Teste une requête via le proxy
 */
function testProxyRequest(host, port = 80, path = '/', protocol = 'http') {
  return new Promise((resolve) => {
    const options = {
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: 'CONNECT',
      path: `${host}:${port}`
    };

    const req = http.request(options);

    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) {
        socket.end();
        resolve({ blocked: false, status: 200 });
      } else {
        socket.end();
        resolve({ blocked: true, status: res.statusCode });
      }
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

/**
 * Teste un domaine
 */
async function testDomain(domain, shouldBlock) {
  stats.total++;

  try {
    const result = await testProxyRequest(domain);

    if (shouldBlock && result.blocked) {
      stats.passed++;
      stats.blocked++;
      logSuccess(`${domain} - BLOQUÉ (comme attendu)`);
      return true;
    } else if (!shouldBlock && !result.blocked) {
      stats.passed++;
      stats.allowed++;
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

/**
 * Teste une IP directe
 */
async function testDirectIP(ip, shouldBlock) {
  stats.total++;

  try {
    const result = await testProxyRequest(ip);

    if (shouldBlock && result.blocked) {
      stats.passed++;
      stats.blocked++;
      logSuccess(`IP ${ip} - BLOQUÉE (comme attendu)`);
      return true;
    } else if (!shouldBlock && !result.blocked) {
      stats.passed++;
      stats.allowed++;
      logSuccess(`IP ${ip} - AUTORISÉE (comme attendu)`);
      return true;
    } else if (shouldBlock && !result.blocked) {
      stats.failed++;
      logError(`IP ${ip} - DEVRAIT ÊTRE BLOQUÉE mais a passé !`);
      return false;
    } else {
      stats.failed++;
      logError(`IP ${ip} - DEVRAIT ÊTRE AUTORISÉE mais a été bloquée !`);
      return false;
    }
  } catch (error) {
    stats.failed++;
    logError(`IP ${ip} - Erreur: ${error.message}`);
    return false;
  }
}

/**
 * Teste une URL HTTP
 */
async function testHTTPUrl(url, shouldBlock) {
  stats.total++;

  try {
    const urlObj = new URL(url);
    const result = await testProxyRequest(urlObj.hostname, urlObj.port || 80);

    if (shouldBlock && result.blocked) {
      stats.passed++;
      stats.blocked++;
      logSuccess(`${url} - HTTP BLOQUÉ (comme attendu)`);
      return true;
    } else if (!shouldBlock && !result.blocked) {
      stats.passed++;
      stats.allowed++;
      logSuccess(`${url} - HTTP AUTORISÉ (comme attendu)`);
      return true;
    } else if (shouldBlock && !result.blocked) {
      stats.failed++;
      logError(`${url} - HTTP DEVRAIT ÊTRE BLOQUÉ mais a passé !`);
      return false;
    } else {
      stats.failed++;
      logError(`${url} - HTTP DEVRAIT ÊTRE AUTORISÉ mais a été bloqué !`);
      return false;
    }
  } catch (error) {
    stats.failed++;
    logError(`${url} - Erreur: ${error.message}`);
    return false;
  }
}

/**
 * Teste un port non standard
 */
async function testNonStandardPort(host, port, shouldBlock) {
  stats.total++;

  try {
    const result = await testProxyRequest(host, port);

    if (shouldBlock && result.blocked) {
      stats.passed++;
      stats.blocked++;
      logSuccess(`${host}:${port} - PORT BLOQUÉ (comme attendu)`);
      return true;
    } else if (!shouldBlock && !result.blocked) {
      stats.passed++;
      stats.allowed++;
      logSuccess(`${host}:${port} - PORT AUTORISÉ (comme attendu)`);
      return true;
    } else if (shouldBlock && !result.blocked) {
      stats.failed++;
      logError(`${host}:${port} - PORT DEVRAIT ÊTRE BLOQUÉ mais a passé !`);
      return false;
    } else {
      stats.failed++;
      logError(`${host}:${port} - PORT DEVRAIT ÊTRE AUTORISÉ mais a été bloqué !`);
      return false;
    }
  } catch (error) {
    stats.failed++;
    logError(`${host}:${port} - Erreur: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXÉCUTION DES TESTS
// ═══════════════════════════════════════════════════════════════════

async function runTestSuite() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🚀 DÉMARRAGE DU TEST ULTRA-PUISSANT - CALMWEB');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Durée: 5 minutes`);
  console.log(`  Proxy: ${PROXY_HOST}:${PROXY_PORT}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  const startTime = Date.now();
  let cycleCount = 0;

  while (Date.now() - startTime < TEST_DURATION) {
    cycleCount++;
    console.log('\n');
    log(`═══════ CYCLE ${cycleCount} ═══════`, '\x1b[35m');
    console.log('\n');

    // Test 1: Sites malveillants
    console.log(`\n${TEST_SUITES.malicious.name}`);
    console.log('─'.repeat(60));
    for (const site of TEST_SUITES.malicious.sites) {
      await testDomain(site, TEST_SUITES.malicious.shouldBlock);
      await sleep(500);
    }

    // Test 2: Publicités
    console.log(`\n${TEST_SUITES.ads.name}`);
    console.log('─'.repeat(60));
    for (const site of TEST_SUITES.ads.sites) {
      await testDomain(site, TEST_SUITES.ads.shouldBlock);
      await sleep(500);
    }

    // Test 3: Logiciels distants
    console.log(`\n${TEST_SUITES.remote.name}`);
    console.log('─'.repeat(60));
    for (const site of TEST_SUITES.remote.sites) {
      await testDomain(site, TEST_SUITES.remote.shouldBlock);
      await sleep(500);
    }

    // Test 4: IPs directes
    console.log(`\n${TEST_SUITES.directIP.name}`);
    console.log('─'.repeat(60));
    for (const ip of TEST_SUITES.directIP.ips) {
      await testDirectIP(ip, TEST_SUITES.directIP.shouldBlock);
      await sleep(500);
    }

    // Test 5: HTTP vs HTTPS
    console.log(`\n${TEST_SUITES.httpVsHttps.name}`);
    console.log('─'.repeat(60));
    for (const url of TEST_SUITES.httpVsHttps.http) {
      await testHTTPUrl(url, TEST_SUITES.httpVsHttps.shouldBlock);
      await sleep(500);
    }

    // Test 6: Ports non standard
    console.log(`\n${TEST_SUITES.portFiltering.name}`);
    console.log('─'.repeat(60));
    for (const { host, port } of TEST_SUITES.portFiltering.nonStandardPorts) {
      await testNonStandardPort(host, port, TEST_SUITES.portFiltering.shouldBlock);
      await sleep(500);
    }

    // Test 7: Sites légitimes
    console.log(`\n${TEST_SUITES.legitimate.name}`);
    console.log('─'.repeat(60));
    for (const site of TEST_SUITES.legitimate.sites) {
      await testDomain(site, TEST_SUITES.legitimate.shouldBlock);
      await sleep(500);
    }

    // Afficher les stats du cycle
    console.log('\n');
    log(`═══════ STATISTIQUES CYCLE ${cycleCount} ═══════`, '\x1b[35m');
    console.log(`Total tests: ${stats.total}`);
    console.log(`\x1b[32mRéussis: ${stats.passed}\x1b[0m`);
    console.log(`\x1b[31mÉchoués: ${stats.failed}\x1b[0m`);
    console.log(`Bloqués: ${stats.blocked}`);
    console.log(`Autorisés: ${stats.allowed}`);
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
  console.log('  🏁 RAPPORT FINAL - TEST ULTRA-PUISSANT');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\n  Durée totale: 5 minutes`);
  console.log(`  Cycles complétés: ${cycleCount}`);
  console.log(`\n  📊 STATISTIQUES GLOBALES`);
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log(`  Total de tests: ${stats.total}`);
  console.log(`  \x1b[32m✓ Réussis: ${stats.passed}\x1b[0m`);
  console.log(`  \x1b[31m✗ Échoués: ${stats.failed}\x1b[0m`);
  console.log(`  🛡️  Bloqués (correctement): ${stats.blocked}`);
  console.log(`  ✅ Autorisés (correctement): ${stats.allowed}`);
  console.log(`\n  🎯 TAUX DE RÉUSSITE: ${((stats.passed / stats.total) * 100).toFixed(2)}%`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (stats.failed === 0) {
    console.log('\n  🎉 PARFAIT ! Tous les tests ont réussi !');
  } else {
    console.log(`\n  ⚠️  ${stats.failed} test(s) ont échoué. Vérifiez la configuration.`);
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
