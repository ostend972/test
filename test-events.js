/**
 * Script de test pour simuler des événements de blocage
 * À exécuter pendant que l'app est ouverte pour voir si les données s'affichent
 */

const backend = require('./backend');

async function testEvents() {
  console.log('\n🧪 Test des événements de sécurité\n');

  try {
    // Initialiser le backend
    await backend.initialize();

    const managers = backend.getManagers();
    const logger = managers.logger;

    // Simuler quelques blocages
    const testDomains = [
      { domain: 'malicious-site.com', reason: 'Malware', source: 'URLhaus' },
      { domain: 'phishing-bank.com', reason: 'Phishing', source: 'PhishingArmy' },
      { domain: 'ad-tracker.net', reason: 'Publicité', source: 'StevenBlack' },
      { domain: 'scam-site.org', reason: 'Arnaque', source: 'HaGeziUltimate' },
      { domain: 'teamviewer.com', reason: 'Logiciel de contrôle à distance', source: 'Blocklist personnalisée' }
    ];

    console.log('📊 Statistiques avant test:');
    console.log(logger.getStats());
    console.log('');

    // Enregistrer les événements
    for (const test of testDomains) {
      console.log(`🚫 Blocage simulé: ${test.domain} (${test.reason})`);
      logger.logBlocked(test.domain, test.reason, test.source);
      await new Promise(resolve => setTimeout(resolve, 500)); // Pause 500ms entre chaque
    }

    // Simuler quelques accès autorisés
    const allowedDomains = ['google.com', 'github.com', 'microsoft.com'];
    for (const domain of allowedDomains) {
      console.log(`✅ Accès autorisé: ${domain}`);
      logger.logAllowed(domain);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n📊 Statistiques après test:');
    const stats = logger.getStats();
    console.log(stats);

    console.log('\n📈 Top catégories bloquées:');
    console.log(logger.getTopBlockedCategories());

    console.log('\n🏆 Top domaines bloqués:');
    console.log(logger.getTopBlockedDomains());

    console.log('\n🔍 Analyse des menaces:');
    console.log(logger.getThreatAnalysis());

    console.log('\n✅ Test terminé! Vérifiez le dashboard pour voir si les événements s\'affichent.\n');

  } catch (error) {
    console.error('❌ Erreur durant le test:', error);
  }
}

// Exécuter le test
testEvents();
