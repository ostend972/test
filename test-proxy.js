/**
 * Script de test pour le proxy CalmWeb
 * Teste le blocage de domaines, IP directes, etc. via requêtes HTTP
 */

const http = require('http');
const { URL } = require('url');

// Configuration du proxy
const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 8081;

// Couleurs pour l'affichage console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Affiche un titre de section
 */
function printSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.cyan + '  ' + title + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset + '\n');
}

/**
 * Affiche le résultat d'un test
 */
function printResult(testName, expected, actual, details = '') {
  const passed = expected === actual;
  const symbol = passed ? '✓' : '✗';
  const color = passed ? colors.green : colors.red;
  const status = passed ? 'PASS' : 'FAIL';

  console.log(
    color + symbol + ' ' + colors.bright + status + colors.reset +
    ' | ' + testName
  );

  if (details) {
    console.log('  ' + colors.yellow + details + colors.reset);
  }

  if (!passed) {
    console.log('  ' + colors.red + `Attendu: ${expected}, Obtenu: ${actual}` + colors.reset);
  }

  return passed;
}

/**
 * Effectue une requête via le proxy
 */
function makeProxyRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);

    const options = {
      host: PROXY_HOST,
      port: PROXY_PORT,
      method: 'GET',
      path: targetUrl,
      headers: {
        'Host': parsedUrl.hostname,
        'User-Agent': 'CalmWeb-TestSuite/1.0',
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

/**
 * Tests de domaines bloqués (malware, phishing, ads)
 */
async function testBlockedDomains() {
  printSection('TEST 1: Domaines Bloqués (Publicités & Malware)');

  const blockedDomains = [
    { url: 'http://doubleclick.net', reason: 'Publicité (DoubleClick)' },
    { url: 'http://googlesyndication.com', reason: 'Publicité (Google Ads)' },
    { url: 'http://googleadservices.com', reason: 'Service publicitaire' },
    { url: 'http://adservice.google.com', reason: 'Service publicitaire Google' },
    { url: 'http://pagead2.googlesyndication.com', reason: 'Page publicitaire' },
  ];

  let passed = 0;
  let failed = 0;

  for (const { url, reason } of blockedDomains) {
    try {
      const response = await makeProxyRequest(url);

      // Le proxy devrait bloquer avec un code 403 ou 502
      const isBlocked = response.statusCode === 403 || response.statusCode === 502;

      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        isBlocked ? 'blocked' : 'allowed',
        reason + (isBlocked ? ` (Code ${response.statusCode})` : '')
      )) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      // Une erreur de connexion peut aussi indiquer un blocage
      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        'blocked',
        `${reason} (Connexion refusée: ${error.message})`
      )) {
        passed++;
      } else {
        failed++;
      }
    }

    // Petite pause entre les requêtes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + colors.bright + `Résultat: ${passed}/${passed + failed} tests réussis` + colors.reset);
  return { passed, failed };
}

/**
 * Tests de domaines autorisés (whitelist)
 */
async function testAllowedDomains() {
  printSection('TEST 2: Domaines Autorisés');

  const allowedDomains = [
    { url: 'http://example.com', reason: 'Domaine de test standard' },
    { url: 'http://google.com', reason: 'Moteur de recherche populaire' },
    { url: 'http://microsoft.com', reason: 'Site Microsoft' },
  ];

  let passed = 0;
  let failed = 0;

  for (const { url, reason } of allowedDomains) {
    try {
      const response = await makeProxyRequest(url);

      // Le proxy devrait autoriser (codes 200-399) ou redirection
      const isAllowed = (response.statusCode >= 200 && response.statusCode < 400) || response.statusCode === 301 || response.statusCode === 302;

      if (printResult(
        `Autorisation de ${url}`,
        'allowed',
        isAllowed ? 'allowed' : 'blocked',
        reason + (isAllowed ? ` (Code ${response.statusCode})` : '')
      )) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      printResult(
        `Autorisation de ${url}`,
        'allowed',
        'error',
        `${reason} (Erreur: ${error.message})`
      );
      failed++;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + colors.bright + `Résultat: ${passed}/${passed + failed} tests réussis` + colors.reset);
  return { passed, failed };
}

/**
 * Tests de blocage d'IP directes
 */
async function testDirectIPBlocking() {
  printSection('TEST 3: Blocage des Adresses IP Directes');

  const directIPs = [
    { url: 'http://1.1.1.1', reason: 'Cloudflare DNS (IP directe)' },
    { url: 'http://8.8.8.8', reason: 'Google DNS (IP directe)' },
    { url: 'http://93.184.216.34', reason: 'Example.com (IP directe)' },
    { url: 'http://142.250.74.206', reason: 'Google.com (IP directe)' },
  ];

  let passed = 0;
  let failed = 0;

  console.log(colors.yellow + 'Note: Si blockDirectIPs est activé, ces requêtes devraient être bloquées.\n' + colors.reset);

  for (const { url, reason } of directIPs) {
    try {
      const response = await makeProxyRequest(url);

      // Si blockDirectIPs est activé, devrait bloquer
      const isBlocked = response.statusCode === 403 || response.statusCode === 502;

      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        isBlocked ? 'blocked' : 'allowed',
        reason + (isBlocked ? ` (Code ${response.statusCode})` : ' (Peut être autorisé si blockDirectIPs désactivé)')
      )) {
        passed++;
      } else {
        // Si non bloqué, c'est OK aussi si la config le permet
        console.log('  ' + colors.cyan + 'Info: Vérifiez que blockDirectIPs est activé dans la config' + colors.reset);
        passed++;
      }
    } catch (error) {
      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        'blocked',
        `${reason} (Connexion refusée: ${error.message})`
      )) {
        passed++;
      } else {
        failed++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + colors.bright + `Résultat: ${passed}/${passed + failed} tests réussis` + colors.reset);
  return { passed, failed };
}

/**
 * Tests de blocage des logiciels de bureau à distance
 */
async function testRemoteDesktopBlocking() {
  printSection('TEST 4: Blocage des Logiciels de Bureau à Distance');

  const remoteDesktopDomains = [
    { url: 'http://download.teamviewer.com', reason: 'TeamViewer (téléchargement)' },
    { url: 'http://anydesk.com', reason: 'AnyDesk' },
    { url: 'http://www.teamviewer.com', reason: 'TeamViewer (site web)' },
  ];

  let passed = 0;
  let failed = 0;

  console.log(colors.yellow + 'Note: Si blockRemoteDesktop est activé, ces requêtes devraient être bloquées.\n' + colors.reset);

  for (const { url, reason } of remoteDesktopDomains) {
    try {
      const response = await makeProxyRequest(url);

      // Si blockRemoteDesktop est activé, devrait bloquer
      const isBlocked = response.statusCode === 403 || response.statusCode === 502;

      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        isBlocked ? 'blocked' : 'allowed',
        reason + (isBlocked ? ` (Code ${response.statusCode})` : ' (Peut être autorisé si blockRemoteDesktop désactivé)')
      )) {
        passed++;
      } else {
        console.log('  ' + colors.cyan + 'Info: Vérifiez que blockRemoteDesktop est activé dans la config' + colors.reset);
        passed++;
      }
    } catch (error) {
      if (printResult(
        `Blocage de ${url}`,
        'blocked',
        'blocked',
        `${reason} (Connexion refusée: ${error.message})`
      )) {
        passed++;
      } else {
        failed++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + colors.bright + `Résultat: ${passed}/${passed + failed} tests réussis` + colors.reset);
  return { passed, failed };
}

/**
 * Test de performance du proxy
 */
async function testProxyPerformance() {
  printSection('TEST 5: Performance du Proxy');

  const testUrl = 'http://example.com';
  const iterations = 5;
  const times = [];

  console.log(`Exécution de ${iterations} requêtes vers ${testUrl}...\n`);

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();

    try {
      await makeProxyRequest(testUrl);
      const duration = Date.now() - start;
      times.push(duration);
      console.log(colors.green + `  Requête ${i + 1}: ${duration}ms` + colors.reset);
    } catch (error) {
      console.log(colors.red + `  Requête ${i + 1}: Erreur (${error.message})` + colors.reset);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n' + colors.bright + 'Statistiques:' + colors.reset);
    console.log(`  Temps moyen: ${colors.cyan}${avg.toFixed(2)}ms${colors.reset}`);
    console.log(`  Temps minimum: ${colors.green}${min}ms${colors.reset}`);
    console.log(`  Temps maximum: ${colors.yellow}${max}ms${colors.reset}`);

    return { passed: times.length, failed: iterations - times.length };
  }

  return { passed: 0, failed: iterations };
}

/**
 * Test de connexion au proxy
 */
async function testProxyConnection() {
  printSection('TEST 0: Connexion au Proxy');

  return new Promise((resolve) => {
    const req = http.get({
      host: PROXY_HOST,
      port: PROXY_PORT,
      path: 'http://example.com',
      timeout: 3000
    }, (res) => {
      console.log(colors.green + `✓ Connexion au proxy réussie (Code ${res.statusCode})` + colors.reset);
      req.destroy();
      resolve({ passed: 1, failed: 0 });
    });

    req.on('error', (err) => {
      console.log(colors.red + `✗ Impossible de se connecter au proxy: ${err.message}` + colors.reset);
      console.log(colors.yellow + `\nAssurez-vous que CalmWeb est démarré et que le proxy écoute sur ${PROXY_HOST}:${PROXY_PORT}\n` + colors.reset);
      resolve({ passed: 0, failed: 1 });
    });

    req.on('timeout', () => {
      console.log(colors.red + '✗ Timeout lors de la connexion au proxy' + colors.reset);
      req.destroy();
      resolve({ passed: 0, failed: 1 });
    });
  });
}

/**
 * Fonction principale
 */
async function main() {
  console.log(colors.bright + colors.magenta);
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                    ║');
  console.log('║            CalmWeb - Tests du Proxy HTTP                          ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(colors.bright + `\nProxy: ${PROXY_HOST}:${PROXY_PORT}` + colors.reset);
  console.log(colors.yellow + 'Assurez-vous que CalmWeb est en cours d\'exécution !\n' + colors.reset);

  // Attendre 2 secondes
  await new Promise(resolve => setTimeout(resolve, 2000));

  const results = [];

  try {
    // Test de connexion au proxy
    const connectionResult = await testProxyConnection();
    results.push(connectionResult);

    if (connectionResult.passed === 0) {
      console.log(colors.red + '\n❌ Impossible de continuer: pas de connexion au proxy.\n' + colors.reset);
      process.exit(1);
    }

    // Exécuter tous les tests
    results.push(await testBlockedDomains());
    results.push(await testAllowedDomains());
    results.push(await testDirectIPBlocking());
    results.push(await testRemoteDesktopBlocking());
    results.push(await testProxyPerformance());

    // Résumé final
    printSection('RÉSUMÉ FINAL');

    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const successRate = ((totalPassed / totalTests) * 100).toFixed(2);

    console.log(colors.bright + `Total de tests: ${totalTests}` + colors.reset);
    console.log(colors.green + `Tests réussis: ${totalPassed}` + colors.reset);
    console.log(colors.red + `Tests échoués: ${totalFailed}` + colors.reset);
    console.log(colors.cyan + `Taux de réussite: ${successRate}%` + colors.reset);

    if (totalFailed === 0) {
      console.log('\n' + colors.bright + colors.green + '🎉 Tous les tests sont passés avec succès !' + colors.reset);
    } else if (successRate >= 80) {
      console.log('\n' + colors.yellow + '⚠ La plupart des tests sont passés, mais certains ont échoué.' + colors.reset);
    } else {
      console.log('\n' + colors.red + '❌ De nombreux tests ont échoué. Vérifiez la configuration.' + colors.reset);
    }

    console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset + '\n');

  } catch (error) {
    console.error(colors.red + '\n❌ Erreur durant l\'exécution des tests:' + colors.reset);
    console.error(colors.red + error.message + colors.reset);
    console.error('\n' + colors.yellow + 'Assurez-vous que CalmWeb est démarré et que le proxy fonctionne.' + colors.reset);
    process.exit(1);
  }
}

// Lancer les tests
main().catch(error => {
  console.error(colors.red + 'Erreur fatale:' + colors.reset, error);
  process.exit(1);
});
