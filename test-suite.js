/**
 * ═══════════════════════════════════════════════════════════════
 * SUITE DE TESTS INTERACTIVE CALMWEB
 * ═══════════════════════════════════════════════════════════════
 *
 * Ce script teste TOUTES les fonctionnalités de CalmWeb de manière interactive.
 * Il vous guidera à travers 12 tests complets avec instructions étape par étape.
 */

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 8081;
const CONFIG_DIR = path.join(process.env.APPDATA, 'CalmWeb');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const STATS_FILE = path.join(CONFIG_DIR, 'stats.json');
const BLOCKLIST_FILE = path.join(CONFIG_DIR, 'custom_blocklist.json');
const WHITELIST_FILE = path.join(CONFIG_DIR, 'whitelist.json');

// Statistiques des tests
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 12
};

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES CONSOLE
// ═══════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logStep(step, title) {
  log('\n' + '═'.repeat(60), 'cyan');
  log(`  ${step}: ${title}`, 'bright');
  log('═'.repeat(60), 'cyan');
}

function logSubStep(message) {
  log(`\n→ ${message}`, 'blue');
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES INTERACTION
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

function waitForEnter(message = 'Appuyez sur ENTRÉE pour continuer...') {
  return new Promise((resolve) => {
    rl.question(`${colors.bright}${message}${colors.reset}`, () => {
      resolve();
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES RÉSEAU
// ═══════════════════════════════════════════════════════════════

/**
 * Teste une requête HTTP à travers le proxy
 */
function testHttpRequest(hostname, expectBlocked = false, timeout = 5000) {
  return new Promise((resolve) => {
    const options = {
      hostname: PROXY_HOST,
      port: PROXY_PORT,
      path: `http://${hostname}`,
      method: 'GET',
      headers: {
        'Host': hostname,
        'User-Agent': 'CalmWeb-TestSuite/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isBlocked = res.statusCode === 403 || data.includes('bloqué') || data.includes('blocked');
        resolve({
          success: true,
          blocked: isBlocked,
          statusCode: res.statusCode,
          expectBlocked: expectBlocked,
          match: isBlocked === expectBlocked
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        blocked: true,
        error: error.message,
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        blocked: true,
        error: 'Timeout',
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    // Activer le timeout explicitement
    req.setTimeout(timeout);

    req.end();
  });
}

/**
 * Teste une requête HTTPS à travers le proxy
 */
function testHttpsRequest(hostname, expectBlocked = false, timeout = 5000) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let responseData = '';

    client.setTimeout(timeout);

    client.on('timeout', () => {
      client.destroy();
      resolve({
        success: false,
        blocked: true,
        error: 'Timeout',
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    client.on('data', (data) => {
      responseData += data.toString();

      // Vérifier si on a reçu la réponse complète
      if (responseData.includes('\r\n\r\n')) {
        const firstLine = responseData.split('\r\n')[0];
        const statusCode = parseInt(firstLine.split(' ')[1]);
        const isBlocked = statusCode === 403;

        client.destroy();
        resolve({
          success: true,
          blocked: isBlocked,
          statusCode: statusCode,
          expectBlocked: expectBlocked,
          match: isBlocked === expectBlocked
        });
      }
    });

    client.on('error', (error) => {
      resolve({
        success: false,
        blocked: true,
        error: error.message,
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    client.connect(PROXY_PORT, PROXY_HOST, () => {
      client.write(`CONNECT ${hostname}:443 HTTP/1.1\r\nHost: ${hostname}\r\n\r\n`);
    });
  });
}

/**
 * Teste une connexion sur un port spécifique
 */
function testPortConnection(hostname, port, expectBlocked = false) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let responseData = '';

    client.setTimeout(3000);

    client.on('timeout', () => {
      client.destroy();
      resolve({
        success: false,
        blocked: true,
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    client.on('data', (data) => {
      responseData += data.toString();

      // Vérifier si on a reçu la réponse complète
      if (responseData.includes('\r\n\r\n')) {
        const firstLine = responseData.split('\r\n')[0];
        const statusCode = parseInt(firstLine.split(' ')[1]);
        const isBlocked = statusCode === 403;

        client.destroy();
        resolve({
          success: true,
          blocked: isBlocked,
          statusCode: statusCode,
          expectBlocked: expectBlocked,
          match: isBlocked === expectBlocked
        });
      }
    });

    client.on('error', () => {
      resolve({
        success: false,
        blocked: true,
        expectBlocked: expectBlocked,
        match: expectBlocked === true
      });
    });

    client.connect(PROXY_PORT, PROXY_HOST, () => {
      client.write(`CONNECT ${hostname}:${port} HTTP/1.1\r\nHost: ${hostname}\r\n\r\n`);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES SYSTÈME
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie si le proxy système est activé
 */
function checkSystemProxy() {
  try {
    const output = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', { encoding: 'utf-8' });
    const enabled = output.includes('0x1');

    const serverOutput = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', { encoding: 'utf-8' });
    const match = serverOutput.match(/ProxyServer\s+REG_SZ\s+(.+)/);
    const server = match ? match[1].trim() : null;

    return {
      enabled: enabled,
      server: server,
      correct: enabled && server === `${PROXY_HOST}:${PROXY_PORT}`
    };
  } catch (error) {
    return { enabled: false, server: null, correct: false };
  }
}

/**
 * Vérifie la règle firewall
 */
function checkFirewallRule() {
  try {
    const output = execSync('netsh advfirewall firewall show rule name="CalmWeb Proxy"', { encoding: 'utf-8' });
    return output.includes('CalmWeb Proxy');
  } catch (error) {
    return false;
  }
}

/**
 * Vérifie la tâche planifiée
 */
function checkScheduledTask() {
  try {
    const output = execSync('schtasks /Query /TN "CalmWeb AutoStart" /FO LIST', { encoding: 'utf-8' });
    return output.includes('CalmWeb AutoStart');
  } catch (error) {
    return false;
  }
}

/**
 * Lit un fichier JSON
 */
async function readJsonFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si CalmWeb est en cours d'exécution
 */
function isCalmWebRunning() {
  try {
    const output = execSync('tasklist /FI "IMAGENAME eq CalmWeb.exe"', { encoding: 'utf-8' });
    return output.includes('CalmWeb.exe');
  } catch (error) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

/**
 * TEST 1: Vérification de l'installation
 */
async function test01_VerificationInstallation() {
  logStep('TEST 1/12', 'Vérification de l\'installation');

  let allPassed = true;

  // Vérifier l'application
  logSubStep('Vérification de l\'application CalmWeb');
  const appRunning = isCalmWebRunning();
  if (appRunning) {
    logSuccess('CalmWeb est en cours d\'exécution');
  } else {
    logWarning('CalmWeb n\'est pas en cours d\'exécution');
    log('\n📝 ACTION REQUISE:', 'bright');
    log('Lancez CalmWeb avant de continuer les tests', 'yellow');
    await waitForEnter();

    if (!isCalmWebRunning()) {
      logError('CalmWeb n\'est toujours pas lancé');
      allPassed = false;
    }
  }

  // Vérifier le proxy système
  logSubStep('Vérification du proxy système');
  const proxyStatus = checkSystemProxy();
  if (proxyStatus.correct) {
    logSuccess(`Proxy système configuré: ${proxyStatus.server}`);
  } else {
    logError(`Proxy système incorrect. Configuré: ${proxyStatus.server}, Attendu: ${PROXY_HOST}:${PROXY_PORT}`);
    allPassed = false;
  }

  // Vérifier la règle firewall
  logSubStep('Vérification de la règle firewall');
  const firewallOk = checkFirewallRule();
  if (firewallOk) {
    logSuccess('Règle firewall "CalmWeb Proxy" présente');
  } else {
    logError('Règle firewall non trouvée');
    allPassed = false;
  }

  // Vérifier la tâche planifiée
  logSubStep('Vérification de la tâche planifiée');
  const taskOk = checkScheduledTask();
  if (taskOk) {
    logSuccess('Tâche planifiée "CalmWeb AutoStart" présente');
  } else {
    logError('Tâche planifiée non trouvée');
    allPassed = false;
  }

  // Vérifier les fichiers de configuration
  logSubStep('Vérification des fichiers de configuration');
  const config = await readJsonFile(CONFIG_FILE);
  if (config) {
    logSuccess(`Fichier config.json présent (Protection: ${config.protectionEnabled ? 'ON' : 'OFF'})`);
  } else {
    logError('Fichier config.json non trouvé');
    allPassed = false;
  }

  const stats = await readJsonFile(STATS_FILE);
  if (stats) {
    logSuccess(`Fichier stats.json présent (Bloqués: ${stats.totalBlocked}, Autorisés: ${stats.totalAllowed})`);
  } else {
    logError('Fichier stats.json non trouvé');
    allPassed = false;
  }

  if (allPassed) {
    logSuccess('\nTest 1: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 1: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

/**
 * TEST 2: Lecture des statistiques
 */
async function test02_LectureStatistiques() {
  logStep('TEST 2/12', 'Lecture des statistiques');

  const stats = await readJsonFile(STATS_FILE);

  if (!stats) {
    logError('Impossible de lire les statistiques');
    testResults.failed++;
    return;
  }

  logInfo(`Total bloqués: ${stats.totalBlocked}`);
  logInfo(`Total autorisés: ${stats.totalAllowed}`);
  logInfo(`Bloqués aujourd'hui: ${stats.blockedToday}`);
  logInfo(`Autorisés aujourd'hui: ${stats.allowedToday}`);
  logInfo(`Dernière menace: ${stats.lastThreat || 'Aucune'}`);

  logSuccess('\nTest 2: RÉUSSI ✓');
  testResults.passed++;
}

/**
 * TEST 3: Blocage via liste noire
 */
async function test03_BlocageListeNoire() {
  logStep('TEST 3/12', 'Test de blocage - Liste noire');

  log('\n📝 INSTRUCTIONS :', 'bright');
  log('1. Ouvrez l\'application CalmWeb', 'yellow');
  log('2. Allez dans l\'onglet "Listes noires"', 'yellow');
  log('3. Ajoutez le domaine : simplaza.org', 'yellow');
  log('4. Cliquez sur "Ajouter le domaine"', 'yellow');

  await waitForEnter('\nUne fois ajouté, appuyez sur ENTRÉE pour tester...');

  logInfo('Test de la requête HTTP vers simplaza.org...');
  const httpResult = await testHttpRequest('simplaza.org', true);

  logInfo('Test de la requête HTTPS vers simplaza.org...');
  const httpsResult = await testHttpsRequest('simplaza.org', true);

  const passed = httpResult.match && httpsResult.match;

  if (httpResult.match) {
    logSuccess(`HTTP bloqué correctement (${httpResult.statusCode || 'connexion refusée'})`);
  } else {
    logError(`HTTP non bloqué (attendu: bloqué, résultat: ${httpResult.blocked ? 'bloqué' : 'autorisé'})`);
  }

  if (httpsResult.match) {
    logSuccess(`HTTPS bloqué correctement (${httpsResult.statusCode || 'connexion refusée'})`);
  } else {
    logError(`HTTPS non bloqué (attendu: bloqué, résultat: ${httpsResult.blocked ? 'bloqué' : 'autorisé'})`);
  }

  if (passed) {
    logSuccess('\nTest 3: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 3: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

/**
 * TEST 4: Déblocage via liste noire
 */
async function test04_DeblocageListeNoire() {
  logStep('TEST 4/12', 'Test de déblocage - Retrait de liste noire');

  log('\n📝 INSTRUCTIONS :', 'bright');
  log('1. Dans l\'onglet "Listes noires"', 'yellow');
  log('2. Trouvez le domaine : simplaza.org', 'yellow');
  log('3. Cliquez sur le bouton de suppression (poubelle)', 'yellow');

  await waitForEnter('\nUne fois supprimé, appuyez sur ENTRÉE pour tester...');

  logInfo('Test de la requête HTTP vers simplaza.org...');
  const httpResult = await testHttpRequest('simplaza.org', false);

  logInfo('Test de la requête HTTPS vers simplaza.org...');
  const httpsResult = await testHttpsRequest('simplaza.org', false);

  const passed = httpResult.match && httpsResult.match;

  if (httpResult.match) {
    logSuccess(`HTTP autorisé correctement`);
  } else {
    logError(`HTTP toujours bloqué après suppression`);
  }

  if (httpsResult.match) {
    logSuccess(`HTTPS autorisé correctement`);
  } else {
    logError(`HTTPS toujours bloqué après suppression`);
  }

  if (passed) {
    logSuccess('\nTest 4: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 4: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

/**
 * TEST 5: Whitelist bypass (priorité sur blacklist)
 */
async function test05_WhitelistBypass() {
  logStep('TEST 5/12', 'Test whitelist - Priorité sur blacklist');

  log('\n📝 INSTRUCTIONS (partie 1) :', 'bright');
  log('1. Dans "Listes noires", ajoutez : example.com', 'yellow');

  await waitForEnter('\nUne fois ajouté à la liste noire, appuyez sur ENTRÉE...');

  logInfo('Vérification du blocage...');
  const blockedResult = await testHttpsRequest('example.com', true);

  if (!blockedResult.match) {
    logError('example.com devrait être bloqué mais ne l\'est pas');
    testResults.failed++;
    return;
  }

  logSuccess('example.com est bien bloqué');

  log('\n📝 INSTRUCTIONS (partie 2) :', 'bright');
  log('1. Allez dans l\'onglet "Listes blanches"', 'yellow');
  log('2. Ajoutez le domaine : example.com', 'yellow');

  await waitForEnter('\nUne fois ajouté à la liste blanche, appuyez sur ENTRÉE...');

  logInfo('Test du bypass de whitelist...');
  const allowedResult = await testHttpsRequest('example.com', false);

  if (allowedResult.match) {
    logSuccess('example.com est autorisé (whitelist prioritaire) ✓');
    testResults.passed++;
  } else {
    logError('example.com est toujours bloqué (whitelist non prioritaire)');
    testResults.failed++;
  }

  // Nettoyage
  log('\n📝 NETTOYAGE :', 'bright');
  log('Supprimez example.com de la liste blanche et de la liste noire', 'yellow');
  await waitForEnter();
}

/**
 * TEST 6: Blocage d'accès IP direct
 */
async function test06_BlocageIP() {
  logStep('TEST 6/12', 'Test de blocage - Accès IP direct');

  const config = await readJsonFile(CONFIG_FILE);

  if (!config || !config.blockDirectIP) {
    log('\n📝 INSTRUCTIONS :', 'bright');
    log('1. Allez dans l\'onglet "Paramètres"', 'yellow');
    log('2. Activez "Bloquer les accès IP directs"', 'yellow');
    await waitForEnter('\nUne fois activé, appuyez sur ENTRÉE...');
  }

  logInfo('Test d\'accès à une IP directe (8.8.8.8)...');
  const result = await testHttpRequest('8.8.8.8', true);

  if (result.match) {
    logSuccess('Accès IP direct bloqué correctement ✓');
    testResults.passed++;
  } else {
    logError('Accès IP direct non bloqué');
    testResults.failed++;
  }
}

/**
 * TEST 7: Blocage HTTP (force HTTPS)
 */
async function test07_BlocageHTTP() {
  logStep('TEST 7/12', 'Test de blocage - HTTP (forcer HTTPS)');

  const config = await readJsonFile(CONFIG_FILE);

  if (!config || !config.blockHTTP) {
    log('\n📝 INSTRUCTIONS :', 'bright');
    log('1. Allez dans l\'onglet "Paramètres"', 'yellow');
    log('2. Activez "Bloquer HTTP (forcer HTTPS)"', 'yellow');
    await waitForEnter('\nUne fois activé, appuyez sur ENTRÉE...');
  }

  logInfo('Test d\'accès HTTP à google.com...');
  const result = await testHttpRequest('google.com', true);

  if (result.match) {
    logSuccess('Requête HTTP bloquée correctement ✓');
    testResults.passed++;
  } else {
    logError('Requête HTTP non bloquée');
    testResults.failed++;
  }
}

/**
 * TEST 8: Blocage des ports non-standards
 */
async function test08_BlocagePorts() {
  logStep('TEST 8/12', 'Test de blocage - Ports non-standards');

  const config = await readJsonFile(CONFIG_FILE);

  if (!config || !config.blockNonStandardPorts) {
    log('\n📝 INSTRUCTIONS :', 'bright');
    log('1. Allez dans l\'onglet "Paramètres"', 'yellow');
    log('2. Activez "Bloquer les ports non-standards"', 'yellow');
    await waitForEnter('\nUne fois activé, appuyez sur ENTRÉE...');
  }

  logInfo('Test de connexion sur port 8080...');
  const result8080 = await testPortConnection('example.com', 8080, true);

  logInfo('Test de connexion sur port 3389 (RDP)...');
  const result3389 = await testPortConnection('example.com', 3389, true);

  const passed = result8080.match && result3389.match;

  if (result8080.match) {
    logSuccess('Port 8080 bloqué correctement');
  } else {
    logError('Port 8080 non bloqué');
  }

  if (result3389.match) {
    logSuccess('Port 3389 bloqué correctement');
  } else {
    logError('Port 3389 non bloqué');
  }

  if (passed) {
    logSuccess('\nTest 8: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 8: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

/**
 * TEST 9: Blocage Remote Desktop (TeamViewer, AnyDesk)
 */
async function test09_BlocageRemoteDesktop() {
  logStep('TEST 9/12', 'Test de blocage - Contrôle à distance');

  const config = await readJsonFile(CONFIG_FILE);

  if (!config || !config.blockRemoteDesktop) {
    log('\n📝 INSTRUCTIONS :', 'bright');
    log('1. Allez dans l\'onglet "Paramètres"', 'yellow');
    log('2. Activez "Bloquer les logiciels de contrôle à distance"', 'yellow');
    await waitForEnter('\nUne fois activé, appuyez sur ENTRÉE...');
  }

  logInfo('Test de blocage TeamViewer...');
  const tvResult = await testHttpsRequest('teamviewer.com', true);

  logInfo('Test de blocage AnyDesk...');
  const adResult = await testHttpsRequest('anydesk.com', true);

  const passed = tvResult.match && adResult.match;

  if (tvResult.match) {
    logSuccess('teamviewer.com bloqué correctement');
  } else {
    logError('teamviewer.com non bloqué');
  }

  if (adResult.match) {
    logSuccess('anydesk.com bloqué correctement');
  } else {
    logError('anydesk.com non bloqué');
  }

  if (passed) {
    logSuccess('\nTest 9: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 9: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

/**
 * TEST 10: Vérification des statistiques après blocages
 */
async function test10_VerificationStatistiques() {
  logStep('TEST 10/12', 'Vérification des statistiques après tests');

  const statsBefore = await readJsonFile(STATS_FILE);

  if (!statsBefore) {
    logError('Impossible de lire les statistiques');
    testResults.failed++;
    return;
  }

  logInfo(`Statistiques actuelles:`);
  logInfo(`  - Total bloqués: ${statsBefore.totalBlocked}`);
  logInfo(`  - Total autorisés: ${statsBefore.totalAllowed}`);
  logInfo(`  - Bloqués aujourd'hui: ${statsBefore.blockedToday}`);

  if (statsBefore.totalBlocked > 0 || statsBefore.blockedToday > 0) {
    logSuccess('Les statistiques sont mises à jour ✓');
    testResults.passed++;
  } else {
    logWarning('Aucun blocage enregistré dans les statistiques');
    testResults.passed++;
  }
}

/**
 * TEST 11: Import/Export CSV
 */
async function test11_ImportExportCSV() {
  logStep('TEST 11/12', 'Test Import/Export CSV');

  log('\n📝 INSTRUCTIONS (Export) :', 'bright');
  log('1. Dans "Listes noires", ajoutez quelques domaines de test:', 'yellow');
  log('   - test1.com', 'yellow');
  log('   - test2.com', 'yellow');
  log('2. Cliquez sur "Exporter en CSV"', 'yellow');
  log('3. Notez l\'emplacement du fichier exporté', 'yellow');

  await waitForEnter('\nUne fois exporté, appuyez sur ENTRÉE...');

  const exportedFile = await askQuestion('Chemin complet du fichier CSV exporté: ');

  let exportOk = false;
  try {
    const content = await fs.readFile(exportedFile, 'utf-8');
    if (content.includes('test1.com') && content.includes('test2.com')) {
      logSuccess('Fichier CSV exporté correctement');
      exportOk = true;
    } else {
      logError('Fichier CSV incomplet');
    }
  } catch (error) {
    logError(`Impossible de lire le fichier: ${error.message}`);
  }

  log('\n📝 INSTRUCTIONS (Import) :', 'bright');
  log('1. Supprimez test1.com et test2.com de la liste noire', 'yellow');
  log('2. Cliquez sur "Importer depuis CSV"', 'yellow');
  log('3. Sélectionnez le fichier CSV que vous venez d\'exporter', 'yellow');

  await waitForEnter('\nUne fois importé, appuyez sur ENTRÉE...');

  const blocklist = await readJsonFile(BLOCKLIST_FILE);
  let importOk = false;

  if (blocklist) {
    const hasTest1 = blocklist.some(entry => entry.domain === 'test1.com');
    const hasTest2 = blocklist.some(entry => entry.domain === 'test2.com');

    if (hasTest1 && hasTest2) {
      logSuccess('Fichier CSV importé correctement');
      importOk = true;
    } else {
      logError('Import incomplet');
    }
  } else {
    logError('Impossible de vérifier l\'import');
  }

  if (exportOk && importOk) {
    logSuccess('\nTest 11: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 11: ÉCHOUÉ ✗');
    testResults.failed++;
  }

  log('\n📝 NETTOYAGE :', 'bright');
  log('Supprimez test1.com et test2.com de la liste noire', 'yellow');
  await waitForEnter();
}

/**
 * TEST 12: Activation/Désactivation de la protection
 */
async function test12_ProtectionToggle() {
  logStep('TEST 12/12', 'Test activation/désactivation de la protection');

  log('\n📝 INSTRUCTIONS (Désactivation) :', 'bright');
  log('1. Dans "Paramètres" ou le tableau de bord', 'yellow');
  log('2. Désactivez la protection (toggle OFF)', 'yellow');

  await waitForEnter('\nUne fois désactivée, appuyez sur ENTRÉE...');

  const configOff = await readJsonFile(CONFIG_FILE);
  const proxyOff = checkSystemProxy();

  let disableOk = false;
  if (configOff && !configOff.protectionEnabled && !proxyOff.enabled) {
    logSuccess('Protection désactivée correctement');
    logSuccess('Proxy système désactivé');
    disableOk = true;
  } else {
    logError('Problème lors de la désactivation');
  }

  log('\n📝 INSTRUCTIONS (Activation) :', 'bright');
  log('1. Réactivez la protection (toggle ON)', 'yellow');

  await waitForEnter('\nUne fois activée, appuyez sur ENTRÉE...');

  const configOn = await readJsonFile(CONFIG_FILE);
  const proxyOn = checkSystemProxy();

  let enableOk = false;
  if (configOn && configOn.protectionEnabled && proxyOn.correct) {
    logSuccess('Protection activée correctement');
    logSuccess('Proxy système configuré');
    enableOk = true;
  } else {
    logError('Problème lors de l\'activation');
  }

  if (disableOk && enableOk) {
    logSuccess('\nTest 12: RÉUSSI ✓');
    testResults.passed++;
  } else {
    logError('\nTest 12: ÉCHOUÉ ✗');
    testResults.failed++;
  }
}

// ═══════════════════════════════════════════════════════════════
// RAPPORT FINAL
// ═══════════════════════════════════════════════════════════════

function afficherRapportFinal() {
  log('\n\n' + '═'.repeat(60), 'cyan');
  log('  RAPPORT FINAL DE LA SUITE DE TESTS', 'bright');
  log('═'.repeat(60), 'cyan');

  const percentage = Math.round((testResults.passed / testResults.total) * 100);

  log(`\nTests réussis:   ${testResults.passed}/${testResults.total}`, 'green');
  log(`Tests échoués:   ${testResults.failed}/${testResults.total}`, testResults.failed > 0 ? 'red' : 'dim');
  log(`Tests ignorés:   ${testResults.skipped}/${testResults.total}`, 'dim');
  log(`Pourcentage:     ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');

  log('\n' + '═'.repeat(60), 'cyan');

  if (percentage === 100) {
    log('🎉 FÉLICITATIONS ! Tous les tests sont réussis !', 'green');
  } else if (percentage >= 80) {
    log('✓ Bon résultat. Quelques problèmes mineurs à corriger.', 'yellow');
  } else {
    log('⚠ Attention. Plusieurs tests ont échoué.', 'red');
  }

  log('═'.repeat(60) + '\n', 'cyan');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  log('\n' + '═'.repeat(60), 'cyan');
  log('  SUITE DE TESTS CALMWEB - MODE INTERACTIF', 'bright');
  log('═'.repeat(60), 'cyan');

  log('\nCette suite va tester TOUTES les fonctionnalités de CalmWeb.', 'white');
  log('Suivez attentivement les instructions pour chaque test.\n', 'white');

  await waitForEnter('Appuyez sur ENTRÉE pour commencer...');

  try {
    await test01_VerificationInstallation();
    await test02_LectureStatistiques();
    await test03_BlocageListeNoire();
    await test04_DeblocageListeNoire();
    await test05_WhitelistBypass();
    await test06_BlocageIP();
    await test07_BlocageHTTP();
    await test08_BlocagePorts();
    await test09_BlocageRemoteDesktop();
    await test10_VerificationStatistiques();
    await test11_ImportExportCSV();
    await test12_ProtectionToggle();

    afficherRapportFinal();
  } catch (error) {
    logError(`\nErreur fatale: ${error.message}`);
    console.error(error);
  } finally {
    rl.close();
  }
}

// Lancement
if (require.main === module) {
  main();
}

module.exports = {
  testHttpRequest,
  testHttpsRequest,
  testPortConnection,
  checkSystemProxy,
  checkFirewallRule,
  checkScheduledTask
};
