const { looksLikeIP } = require('./backend/utils');

// Test de détection d'IP
const testCases = [
  '192.168.1.48',
  '127.0.0.1',
  '8.8.8.8',
  'google.com',
  'example.com',
  '192.168.1.1',
  '10.0.0.1'
];

console.log('🧪 Test de détection d\'IP :\n');

testCases.forEach(testCase => {
  const result = looksLikeIP(testCase);
  console.log(`${testCase.padEnd(20)} → ${result ? '✅ IP détectée' : '❌ Non détectée comme IP'}`);
});
