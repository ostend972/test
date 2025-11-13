/**
 * Test de diagnostic pour comprendre pourquoi fls-eu.amazon.fr est bloqué
 */

const backend = require('./backend');

async function testAmazonBlocking() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   DIAGNOSTIC: Blocage de fls-eu.amazon.fr');
  console.log('═══════════════════════════════════════════════════\n');

  await backend.initialize();
  const { blocklist, config } = backend.getManagers();

  console.log('✓ Backend initialisé\n');

  // Liste des domaines à tester
  const domainsToTest = [
    'amazon.fr',
    'www.amazon.fr',
    'fls-eu.amazon.fr',
    'fls-eu.amazon-adsystem.com',
    'fls-fe.amazon-adsystem.com',
    'fls-na.amazon-adsystem.com',
    'fls-na.amazon.com',
  ];

  console.log('TEST DES DOMAINES AMAZON');
  console.log('═══════════════════════════════════════════════════\n');

  domainsToTest.forEach(domain => {
    const result = blocklist.isBlocked(domain);
    const isBlocked = result && result.blocked === true;

    console.log(`Domaine: ${domain}`);
    console.log(`  Résultat: ${isBlocked ? '🚫 BLOQUÉ' : '✓ AUTORISÉ'}`);

    if (isBlocked) {
      console.log(`  Raison: ${result.reason}`);
      console.log(`  Source: ${result.source}`);
    }
    console.log('');
  });

  // Vérifier si les domaines exacts sont dans la blocklist
  console.log('VÉRIFICATION DANS LA BLOCKLIST');
  console.log('═══════════════════════════════════════════════════\n');

  const exactChecks = [
    'fls-eu.amazon.fr',
    'amazon.fr',
    'amazon-adsystem.com',
    'fls-eu.amazon-adsystem.com',
  ];

  exactChecks.forEach(domain => {
    const inMainList = blocklist.blockedDomains.has(domain);
    const inCustomList = blocklist.customBlockedDomains.has(domain);

    console.log(`Domaine: ${domain}`);
    console.log(`  Dans blocklist principale: ${inMainList ? 'OUI' : 'NON'}`);
    console.log(`  Dans blocklist custom: ${inCustomList ? 'OUI' : 'NON'}`);
    console.log('');
  });

  // Chercher tous les domaines amazon dans la blocklist
  console.log('RECHERCHE DE TOUS LES DOMAINES AMAZON DANS LA BLOCKLIST');
  console.log('═══════════════════════════════════════════════════\n');

  const amazonDomains = Array.from(blocklist.blockedDomains)
    .filter(d => d.includes('amazon'))
    .sort();

  console.log(`Total de domaines contenant "amazon": ${amazonDomains.length}\n`);

  // Afficher les premiers 50 pour voir
  console.log('Premiers 50 domaines amazon dans la blocklist:');
  amazonDomains.slice(0, 50).forEach((domain, index) => {
    console.log(`  ${index + 1}. ${domain}`);
  });

  if (amazonDomains.length > 50) {
    console.log(`  ... et ${amazonDomains.length - 50} autres`);
  }

  console.log('\n');

  // Vérifier si amazon.fr est dans la liste
  console.log('DOMAINES AMAZON.FR DANS LA BLOCKLIST:');
  console.log('═══════════════════════════════════════════════════\n');

  const amazonFrDomains = amazonDomains.filter(d => d.includes('amazon.fr'));

  if (amazonFrDomains.length === 0) {
    console.log('  ✓ Aucun domaine amazon.fr dans la blocklist');
  } else {
    console.log(`  ⚠️  ${amazonFrDomains.length} domaine(s) amazon.fr trouvé(s):\n`);
    amazonFrDomains.forEach((domain, index) => {
      console.log(`  ${index + 1}. ${domain}`);
    });
  }

  console.log('\n');

  // Test de la logique de détection des sous-domaines
  console.log('TEST DE LA LOGIQUE DE SOUS-DOMAINES');
  console.log('═══════════════════════════════════════════════════\n');

  const testDomain = 'fls-eu.amazon.fr';
  const parts = testDomain.split('.');

  console.log(`Domaine testé: ${testDomain}`);
  console.log(`Parties: [${parts.join(', ')}]\n`);
  console.log('Vérification des domaines parents:');

  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    const inList = blocklist.blockedDomains.has(parent);
    console.log(`  ${i}. ${parent} → ${inList ? '🚫 DANS LA LISTE' : '✓ Pas dans la liste'}`);
  }

  console.log('\n═══════════════════════════════════════════════════\n');

  process.exit(0);
}

testAmazonBlocking().catch(error => {
  console.error('Erreur lors du test:', error);
  process.exit(1);
});
