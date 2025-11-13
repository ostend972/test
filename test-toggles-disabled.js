/**
 * Test pour vérifier que les toggles désactivés n'bloquent PAS
 */

const backend = require('./backend');

async function testTogglesDisabled() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TEST DES TOGGLES DÉSACTIVÉS');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { config, proxy } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  // Vérifier que tous les toggles sont bien désactivés
  console.log('VÉRIFICATION DE LA CONFIGURATION');
  console.log('─────────────────────────────────────');
  const currentConfig = config.get();
  console.log('  blockNonStandardPorts:', currentConfig.blockNonStandardPorts);
  console.log('  blockDirectIPs:', currentConfig.blockDirectIPs);
  console.log('  blockRemoteDesktop:', currentConfig.blockRemoteDesktop);
  console.log('');

  // Test 1: Ports non standard (DOIT AUTORISER)
  console.log('TEST 1: Ports non standard avec toggle DÉSACTIVÉ');
  console.log('─────────────────────────────────────');

  const result1 = proxy.shouldBlock('example.com:8080', false, 8080);
  console.log('  Test example.com:8080 (port non standard):', result1.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result1.blocked) {
    console.log('  ⚠️  PROBLÈME: Le port devrait être autorisé!');
    console.log('  Raison du blocage:', result1.reason);
  }

  const result2 = proxy.shouldBlock('test.com:3000', false, 3000);
  console.log('  Test test.com:3000 (port non standard):', result2.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result2.blocked) {
    console.log('  ⚠️  PROBLÈME: Le port devrait être autorisé!');
    console.log('  Raison du blocage:', result2.reason);
  }
  console.log('');

  // Test 2: Adresses IP directes (DOIT AUTORISER)
  console.log('TEST 2: Adresses IP directes avec toggle DÉSACTIVÉ');
  console.log('─────────────────────────────────────');

  const result3 = proxy.shouldBlock('192.168.1.1', false, 80);
  console.log('  Test 192.168.1.1:', result3.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result3.blocked) {
    console.log('  ⚠️  PROBLÈME: L\'IP devrait être autorisée!');
    console.log('  Raison du blocage:', result3.reason);
  }

  const result4 = proxy.shouldBlock('8.8.8.8', false, 443);
  console.log('  Test 8.8.8.8:', result4.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result4.blocked) {
    console.log('  ⚠️  PROBLÈME: L\'IP devrait être autorisée!');
    console.log('  Raison du blocage:', result4.reason);
  }
  console.log('');

  // Test 3: Remote Desktop (DOIT AUTORISER)
  console.log('TEST 3: TeamViewer / AnyDesk avec toggle DÉSACTIVÉ');
  console.log('─────────────────────────────────────');

  const result5 = proxy.shouldBlock('teamviewer.com', true, 443);
  console.log('  Test teamviewer.com:', result5.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result5.blocked) {
    console.log('  ⚠️  PROBLÈME: TeamViewer devrait être autorisé!');
    console.log('  Raison du blocage:', result5.reason);
  }

  const result6 = proxy.shouldBlock('anydesk.com', true, 443);
  console.log('  Test anydesk.com:', result6.blocked ? '✗ BLOQUÉ (ERREUR!)' : '✓ AUTORISÉ');
  if (result6.blocked) {
    console.log('  ⚠️  PROBLÈME: AnyDesk devrait être autorisé!');
    console.log('  Raison du blocage:', result6.reason);
  }
  console.log('');

  // Résumé
  console.log('═══════════════════════════════════════════════════');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════');

  const allPassed = !result1.blocked && !result2.blocked && !result3.blocked &&
                    !result4.blocked && !result5.blocked && !result6.blocked;

  if (allPassed) {
    console.log('  ✓ TOUS LES TESTS RÉUSSIS!');
    console.log('  ✓ Les toggles désactivés n\'bloquent plus rien');
    console.log('  ✓ Comportement 100% correct!');
  } else {
    console.log('  ✗ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('  ✗ Les toggles désactivés bloquent encore du trafic');
    console.log('  ✗ Vérifier la configuration!');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

testTogglesDisabled().catch(error => {
  console.error('Erreur lors des tests:', error);
  process.exit(1);
});
