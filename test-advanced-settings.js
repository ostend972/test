/**
 * Test des paramètres avancés (Intervalle de mise à jour + Port du proxy)
 */

const backend = require('./backend');

async function testAdvancedSettings() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TEST DES PARAMÈTRES AVANCÉS');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { config, proxy } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  // Sauvegarder la configuration initiale
  const initialConfig = config.get();
  console.log('CONFIGURATION INITIALE:');
  console.log('─────────────────────────────────────');
  console.log('Intervalle de mise à jour:', initialConfig.updateInterval, 'heures');
  console.log('Port du proxy:', initialConfig.proxyPort);
  console.log('');

  let allTestsPassed = true;

  // ═══════════════════════════════════════════════════════
  // TEST 1: Intervalle de mise à jour
  // ═══════════════════════════════════════════════════════
  console.log('TEST 1: Modification de l\'intervalle de mise à jour');
  console.log('═══════════════════════════════════════════════════');

  // Test 1.1: Changer l'intervalle à 12 heures
  console.log('  Test 1.1: Passer de', initialConfig.updateInterval, 'h à 12h');
  await config.update({ updateInterval: 12 });
  let currentConfig = config.get();

  if (currentConfig.updateInterval === 12) {
    console.log('  ✓ Intervalle modifié: 12 heures');
  } else {
    console.log('  ✗ ÉCHEC: Intervalle non modifié');
    allTestsPassed = false;
  }

  // Test 1.2: Changer l'intervalle à 48 heures
  console.log('  Test 1.2: Passer de 12h à 48h');
  await config.update({ updateInterval: 48 });
  currentConfig = config.get();

  if (currentConfig.updateInterval === 48) {
    console.log('  ✓ Intervalle modifié: 48 heures');
  } else {
    console.log('  ✗ ÉCHEC: Intervalle non modifié');
    allTestsPassed = false;
  }

  // Test 1.3: Changer l'intervalle à 6 heures
  console.log('  Test 1.3: Passer de 48h à 6h');
  await config.update({ updateInterval: 6 });
  currentConfig = config.get();

  if (currentConfig.updateInterval === 6) {
    console.log('  ✓ Intervalle modifié: 6 heures');
  } else {
    console.log('  ✗ ÉCHEC: Intervalle non modifié');
    allTestsPassed = false;
  }

  // Vérifier que la configuration est persistée
  console.log('  Test 1.4: Vérifier la persistence');
  const reloadedConfig = config.get();
  if (reloadedConfig.updateInterval === 6) {
    console.log('  ✓ Configuration persistée correctement');
  } else {
    console.log('  ✗ ÉCHEC: Configuration non persistée');
    allTestsPassed = false;
  }

  console.log('');

  // ═══════════════════════════════════════════════════════
  // TEST 2: Port du proxy
  // ═══════════════════════════════════════════════════════
  console.log('TEST 2: Modification du port du proxy');
  console.log('═══════════════════════════════════════════════════');

  const initialPort = initialConfig.proxyPort;
  console.log('  Port initial:', initialPort);

  // Test 2.1: Changer le port à 8888
  console.log('  Test 2.1: Passer de', initialPort, 'à 8888');
  try {
    await config.update({ proxyPort: 8888 });
    currentConfig = config.get();

    if (currentConfig.proxyPort === 8888) {
      console.log('  ✓ Port modifié: 8888');
    } else {
      console.log('  ✗ ÉCHEC: Port non modifié');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ ÉCHEC:', error.message);
    allTestsPassed = false;
  }

  // Test 2.2: Changer le port à 9090
  console.log('  Test 2.2: Passer de 8888 à 9090');
  try {
    await config.update({ proxyPort: 9090 });
    currentConfig = config.get();

    if (currentConfig.proxyPort === 9090) {
      console.log('  ✓ Port modifié: 9090');
    } else {
      console.log('  ✗ ÉCHEC: Port non modifié');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ✗ ÉCHEC:', error.message);
    allTestsPassed = false;
  }

  // Test 2.3: Test de validation - port invalide (< 1024)
  console.log('  Test 2.3: Tenter de définir un port invalide (500)');
  try {
    await config.set('proxyPort', 500);
    console.log('  ✗ ÉCHEC: Port invalide accepté (devrait être refusé)');
    allTestsPassed = false;
  } catch (error) {
    console.log('  ✓ Port invalide refusé:', error.message);
  }

  // Test 2.4: Test de validation - port invalide (> 65535)
  console.log('  Test 2.4: Tenter de définir un port invalide (70000)');
  try {
    await config.set('proxyPort', 70000);
    console.log('  ✗ ÉCHEC: Port invalide accepté (devrait être refusé)');
    allTestsPassed = false;
  } catch (error) {
    console.log('  ✓ Port invalide refusé:', error.message);
  }

  // Test 2.5: Vérifier que la configuration est persistée
  console.log('  Test 2.5: Vérifier la persistence');
  const finalConfig = config.get();
  if (finalConfig.proxyPort === 9090) {
    console.log('  ✓ Configuration du port persistée correctement');
  } else {
    console.log('  ✗ ÉCHEC: Configuration du port non persistée');
    allTestsPassed = false;
  }

  console.log('');

  // ═══════════════════════════════════════════════════════
  // TEST 3: Vérifier l'impact sur le système
  // ═══════════════════════════════════════════════════════
  console.log('TEST 3: Impact sur le système');
  console.log('═══════════════════════════════════════════════════');

  // Test 3.1: Vérifier que l'intervalle est utilisé par shouldUpdateList
  console.log('  Test 3.1: Vérifier l\'utilisation de l\'intervalle par blocklist');
  const { blocklist } = backend.getManagers();

  // Forcer l'intervalle à 1 heure pour tester
  await config.update({ updateInterval: 1 });

  // Simuler une ancienne mise à jour (2 heures)
  blocklist.listMetadata.stevenBlack.lastUpdate = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const shouldUpdate = blocklist.shouldUpdateList('stevenBlack');
  if (shouldUpdate === true) {
    console.log('  ✓ shouldUpdateList respecte l\'intervalle (2h > 1h = doit mettre à jour)');
  } else {
    console.log('  ✗ ÉCHEC: shouldUpdateList ne respecte pas l\'intervalle');
    allTestsPassed = false;
  }

  // Test 3.2: Liste récente ne devrait pas être mise à jour
  blocklist.listMetadata.stevenBlack.lastUpdate = new Date(Date.now() - 30 * 60 * 1000); // 30 min
  const shouldNotUpdate = blocklist.shouldUpdateList('stevenBlack');
  if (shouldNotUpdate === false) {
    console.log('  ✓ shouldUpdateList respecte l\'intervalle (30min < 1h = pas de MAJ)');
  } else {
    console.log('  ✗ ÉCHEC: shouldUpdateList met à jour trop tôt');
    allTestsPassed = false;
  }

  console.log('');

  // ═══════════════════════════════════════════════════════
  // RESTAURATION DE LA CONFIGURATION INITIALE
  // ═══════════════════════════════════════════════════════
  console.log('RESTAURATION DE LA CONFIGURATION INITIALE');
  console.log('═══════════════════════════════════════════════════');
  await config.update({
    updateInterval: initialConfig.updateInterval,
    proxyPort: initialConfig.proxyPort
  });

  const restoredConfig = config.get();
  console.log('  Intervalle restauré:', restoredConfig.updateInterval, 'heures');
  console.log('  Port restauré:', restoredConfig.proxyPort);
  console.log('  ✓ Configuration initiale restaurée');
  console.log('');

  // ═══════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════');

  if (allTestsPassed) {
    console.log('  ✓✓✓ TOUS LES TESTS RÉUSSIS! ✓✓✓');
    console.log('');
    console.log('  ✓ Intervalle de mise à jour: FONCTIONNEL');
    console.log('    - Modification de l\'intervalle: OK');
    console.log('    - Persistence de la config: OK');
    console.log('    - Utilisation par shouldUpdateList: OK');
    console.log('');
    console.log('  ✓ Port du proxy: FONCTIONNEL');
    console.log('    - Modification du port: OK');
    console.log('    - Validation des ports invalides: OK');
    console.log('    - Persistence de la config: OK');
  } else {
    console.log('  ✗ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('  Consultez les détails ci-dessus');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allTestsPassed ? 0 : 1);
}

testAdvancedSettings().catch(error => {
  console.error('Erreur lors des tests:', error);
  process.exit(1);
});
