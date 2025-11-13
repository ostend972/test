/**
 * Test du système de blocage des sous-domaines
 */

const backend = require('./backend');

async function testSubdomainBlocking() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   TEST DU BLOCAGE DES SOUS-DOMAINES');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { blocklist } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  // Ajouter des domaines de test dans la blocklist custom
  console.log('PRÉPARATION DES TESTS');
  console.log('─────────────────────────────────────');

  // Ajouter mads.amazon.com comme exemple
  blocklist.customBlockedDomains.add('mads.amazon.com');
  blocklist.customBlockedDomains.add('evil.example.com');

  console.log('  Domaines ajoutés à la blocklist:');
  console.log('    - mads.amazon.com');
  console.log('    - evil.example.com');
  console.log('');

  // Tests
  const tests = [
    // Test avec amazon.com / mads.amazon.com
    {
      name: 'amazon.com (domaine parent)',
      domain: 'amazon.com',
      expected: false,
      reason: 'Le domaine parent n\'est PAS bloqué quand le sous-domaine l\'est'
    },
    {
      name: 'mads.amazon.com (match exact)',
      domain: 'mads.amazon.com',
      expected: true,
      reason: 'Match exact avec la blocklist'
    },
    {
      name: 'sub.mads.amazon.com (sous-domaine du bloqué)',
      domain: 'sub.mads.amazon.com',
      expected: true,
      reason: 'Bloqué car mads.amazon.com (parent) est dans la blocklist'
    },
    {
      name: 'deep.sub.mads.amazon.com (sous-domaine profond)',
      domain: 'deep.sub.mads.amazon.com',
      expected: true,
      reason: 'Bloqué car mads.amazon.com (parent) est dans la blocklist'
    },
    {
      name: 'other.amazon.com (autre sous-domaine)',
      domain: 'other.amazon.com',
      expected: false,
      reason: 'Autre sous-domaine non bloqué'
    },

    // Test avec example.com / evil.example.com
    {
      name: 'example.com (domaine parent)',
      domain: 'example.com',
      expected: false,
      reason: 'Le domaine parent n\'est PAS bloqué quand le sous-domaine l\'est'
    },
    {
      name: 'evil.example.com (match exact)',
      domain: 'evil.example.com',
      expected: true,
      reason: 'Match exact avec la blocklist'
    },
    {
      name: 'sub.evil.example.com (sous-domaine du bloqué)',
      domain: 'sub.evil.example.com',
      expected: true,
      reason: 'Bloqué car evil.example.com (parent) est dans la blocklist'
    },
    {
      name: 'good.example.com (autre sous-domaine)',
      domain: 'good.example.com',
      expected: false,
      reason: 'Autre sous-domaine non bloqué'
    },
  ];

  console.log('EXÉCUTION DES TESTS');
  console.log('═══════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    const result = blocklist.isBlocked(test.domain);
    const isBlocked = result && result.blocked === true;
    const success = isBlocked === test.expected;

    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Domaine: ${test.domain}`);
    console.log(`  Attendu: ${test.expected ? 'BLOQUÉ' : 'AUTORISÉ'}`);
    console.log(`  Résultat: ${isBlocked ? 'BLOQUÉ' : 'AUTORISÉ'}`);

    if (success) {
      console.log(`  ✓ SUCCÈS - ${test.reason}`);
      passed++;
    } else {
      console.log(`  ✗ ÉCHEC - ${test.reason}`);
      failed++;
    }
    console.log('');
  });

  // Nettoyer
  blocklist.customBlockedDomains.delete('mads.amazon.com');
  blocklist.customBlockedDomains.delete('evil.example.com');

  // Résumé
  console.log('═══════════════════════════════════════════════════');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Tests réussis: ${passed}/${tests.length}`);
  console.log(`  Tests échoués: ${failed}/${tests.length}`);
  console.log('');

  if (failed === 0) {
    console.log('  ✓✓✓ TOUS LES TESTS RÉUSSIS! ✓✓✓');
    console.log('');
    console.log('  COMPORTEMENT DU SYSTÈME:');
    console.log('  ─────────────────────────────────────────');
    console.log('  ✓ Si mads.amazon.com est bloqué:');
    console.log('    - amazon.com → AUTORISÉ ✓');
    console.log('    - mads.amazon.com → BLOQUÉ ✗');
    console.log('    - sub.mads.amazon.com → BLOQUÉ ✗');
    console.log('');
    console.log('  ✓ Le système bloque le domaine ET ses sous-domaines');
    console.log('  ✓ Le système N\'affecte PAS les domaines parents');
  } else {
    console.log('  ✗ Certains tests ont échoué');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failed === 0 ? 0 : 1);
}

testSubdomainBlocking().catch(error => {
  console.error('Erreur lors des tests:', error);
  process.exit(1);
});
