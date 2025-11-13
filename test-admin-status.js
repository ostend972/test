/**
 * Test script pour vérifier le statut administrateur
 */

const { isAdmin } = require('./check-admin');

console.log('='.repeat(60));
console.log('TEST: Statut Administrateur');
console.log('='.repeat(60));

const adminStatus = isAdmin();

console.log(`\nStatut: ${adminStatus ? '✓ ADMIN' : '✗ PAS ADMIN'}`);

if (adminStatus) {
  console.log('L\'application tourne avec des privilèges administrateur');
} else {
  console.log('L\'application NE tourne PAS avec des privilèges administrateur');
  console.log('Le proxy système pourrait ne pas fonctionner correctement');
}

console.log('\n' + '='.repeat(60));

process.exit(0);
