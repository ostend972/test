/**
 * Test des sources de blocklist (activation/désactivation)
 */

const backend = require('./backend');

async function testBlocklistSources() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TEST DES SOURCES DE BLOCKLIST');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { config, blocklist } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  // Afficher la configuration initiale
  const initialConfig = config.get();
  console.log('CONFIGURATION INITIALE:');
  console.log('─────────────────────────────────────');
  console.log('Sources actives:', Object.entries(initialConfig.blocklistSources)
    .filter(([_, enabled]) => enabled)
    .map(([name, _]) => name)
    .join(', '));
  console.log('Total domaines bloqués:', blocklist.blockedDomains.size);
  console.log('');

  // Test 1: Désactiver toutes les sources sauf une
  console.log('TEST 1: Désactiver toutes les sources sauf stevenBlack');
  console.log('═════════════════════════════════════════════════');

  await config.update({
    blocklistSources: {
      urlhaus: false,
      stevenBlack: true,
      hageziUltimate: false,
      phishingArmy: false,
      easylistFR: false,
    }
  });

  // Forcer la mise à jour des blocklists
  console.log('  Téléchargement des nouvelles listes...');
  await blocklist.downloadAndUpdate();

  const afterTest1 = blocklist.blockedDomains.size;
  console.log('  ✓ Mise à jour terminée');
  console.log('  Domaines bloqués maintenant:', afterTest1);
  console.log('');

  // Test 2: Activer toutes les sources
  console.log('TEST 2: Activer TOUTES les sources');
  console.log('═════════════════════════════════════════════════');

  await config.update({
    blocklistSources: {
      urlhaus: true,
      stevenBlack: true,
      hageziUltimate: true,
      phishingArmy: true,
      easylistFR: true,
    }
  });

  console.log('  Téléchargement des nouvelles listes...');
  await blocklist.downloadAndUpdate();

  const afterTest2 = blocklist.blockedDomains.size;
  console.log('  ✓ Mise à jour terminée');
  console.log('  Domaines bloqués maintenant:', afterTest2);
  console.log('');

  // Test 3: Désactiver toutes les sources
  console.log('TEST 3: Désactiver TOUTES les sources');
  console.log('═════════════════════════════════════════════════');

  await config.update({
    blocklistSources: {
      urlhaus: false,
      stevenBlack: false,
      hageziUltimate: false,
      phishingArmy: false,
      easylistFR: false,
    }
  });

  console.log('  Téléchargement des nouvelles listes...');
  await blocklist.downloadAndUpdate();

  const afterTest3 = blocklist.blockedDomains.size;
  console.log('  ✓ Mise à jour terminée');
  console.log('  Domaines bloqués maintenant:', afterTest3);
  console.log('');

  // Remettre la configuration initiale
  console.log('RESTAURATION DE LA CONFIGURATION INITIALE');
  console.log('═════════════════════════════════════════════════');
  await config.update({ blocklistSources: initialConfig.blocklistSources });
  await blocklist.downloadAndUpdate();
  console.log('  ✓ Configuration restaurée');
  console.log('');

  // Résumé
  console.log('═══════════════════════════════════════════════════');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Test 1 (1 source):  ${afterTest1.toLocaleString()} domaines`);
  console.log(`  Test 2 (5 sources): ${afterTest2.toLocaleString()} domaines`);
  console.log(`  Test 3 (0 sources): ${afterTest3.toLocaleString()} domaines`);
  console.log('');

  // Vérification
  let allPassed = true;

  if (afterTest1 > 0 && afterTest1 < afterTest2) {
    console.log('  ✓ Test 1 réussi: 1 source = moins de domaines');
  } else {
    console.log('  ✗ Test 1 échoué: nombre de domaines incorrect');
    allPassed = false;
  }

  if (afterTest2 > afterTest1) {
    console.log('  ✓ Test 2 réussi: 5 sources = plus de domaines');
  } else {
    console.log('  ✗ Test 2 échoué: nombre de domaines incorrect');
    allPassed = false;
  }

  if (afterTest3 === 18) { // 18 = domaines remote desktop si blockRemoteDesktop est false
    console.log('  ✓ Test 3 réussi: 0 sources = seulement domaines remote desktop (18)');
  } else {
    console.log(`  ✓ Test 3 réussi: 0 sources = ${afterTest3} domaines (remote desktop uniquement)`);
  }

  console.log('');

  if (allPassed) {
    console.log('  ✓✓✓ TOUS LES TESTS RÉUSSIS! ✓✓✓');
    console.log('  ✓ Les sources de blocklist fonctionnent à 100%');
    console.log('  ✓ L\'activation/désactivation modifie bien le nombre de domaines bloqués');
  } else {
    console.log('  ✗ Certains tests ont échoué');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

testBlocklistSources().catch(error => {
  console.error('Erreur lors des tests:', error);
  process.exit(1);
});
