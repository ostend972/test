/**
 * Test complet des toggles: activation ET désactivation
 */

const backend = require('./backend');

async function testComprehensive() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TEST COMPLET DES TOGGLES');
  console.log('   (Activation + Désactivation)');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { config, proxy, blocklist } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  let totalTests = 0;
  let passedTests = 0;

  // ============================================================
  // TEST 1: blockNonStandardPorts
  // ============================================================
  console.log('TEST 1: blockNonStandardPorts');
  console.log('═════════════════════════════════════════════════');

  // Activer
  await config.update({ blockNonStandardPorts: true });
  let result = proxy.shouldBlock('example.com:8080', 8080, true); // HTTPS to avoid HTTP block
  totalTests++;
  if (result.blocked) {
    console.log('  ✓ Toggle activé: port 8080 BLOQUÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle activé: port 8080 devrait être bloqué');
  }

  // Désactiver
  await config.update({ blockNonStandardPorts: false });
  result = proxy.shouldBlock('example.com:8080', 8080, true); // HTTPS to avoid HTTP block
  totalTests++;
  if (!result.blocked) {
    console.log('  ✓ Toggle désactivé: port 8080 AUTORISÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle désactivé: port 8080 devrait être autorisé');
  }
  console.log('');

  // ============================================================
  // TEST 2: blockDirectIPs
  // ============================================================
  console.log('TEST 2: blockDirectIPs');
  console.log('═════════════════════════════════════════════════');

  // Activer
  await config.update({ blockDirectIPs: true });
  result = proxy.shouldBlock('8.8.8.8', 443, true); // HTTPS to avoid HTTP block
  totalTests++;
  if (result.blocked) {
    console.log('  ✓ Toggle activé: 8.8.8.8 BLOQUÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle activé: 8.8.8.8 devrait être bloqué');
  }

  // Désactiver
  await config.update({ blockDirectIPs: false });
  result = proxy.shouldBlock('8.8.8.8', 443, true); // HTTPS to avoid HTTP block
  totalTests++;
  if (!result.blocked) {
    console.log('  ✓ Toggle désactivé: 8.8.8.8 AUTORISÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle désactivé: 8.8.8.8 devrait être autorisé');
  }
  console.log('');

  // ============================================================
  // TEST 3: blockRemoteDesktop
  // ============================================================
  console.log('TEST 3: blockRemoteDesktop');
  console.log('═════════════════════════════════════════════════');

  // Activer et recharger la blocklist
  await config.update({ blockRemoteDesktop: true });
  await blocklist.reload();
  result = proxy.shouldBlock('teamviewer.com', 443, true);
  totalTests++;
  if (result.blocked) {
    console.log('  ✓ Toggle activé: teamviewer.com BLOQUÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle activé: teamviewer.com devrait être bloqué');
  }

  // Désactiver et recharger la blocklist
  await config.update({ blockRemoteDesktop: false });
  await blocklist.reload();
  result = proxy.shouldBlock('teamviewer.com', 443, true);
  totalTests++;
  if (!result.blocked) {
    console.log('  ✓ Toggle désactivé: teamviewer.com AUTORISÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle désactivé: teamviewer.com devrait être autorisé');
  }

  result = proxy.shouldBlock('anydesk.com', 443, true);
  totalTests++;
  if (!result.blocked) {
    console.log('  ✓ Toggle désactivé: anydesk.com AUTORISÉ');
    passedTests++;
  } else {
    console.log('  ✗ Toggle désactivé: anydesk.com devrait être autorisé');
  }
  console.log('');

  // ============================================================
  // RÉSUMÉ
  // ============================================================
  console.log('═══════════════════════════════════════════════════');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Tests réussis: ${passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    console.log('  ✓✓✓ TOUS LES TESTS RÉUSSIS! ✓✓✓');
    console.log('  ✓ Les toggles fonctionnent à 100%');
    console.log('  ✓ Activation et désactivation correctes');
  } else {
    console.log(`  ✗ ${totalTests - passedTests} test(s) échoué(s)`);
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

testComprehensive().catch(error => {
  console.error('Erreur lors des tests:', error);
  process.exit(1);
});
