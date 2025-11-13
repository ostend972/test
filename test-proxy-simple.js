const http = require('http');

console.log('Test simple du proxy...');

const req = http.request({
  hostname: '127.0.0.1',
  port: 8081,
  method: 'CONNECT',
  path: 'simplaza.org:443'
}, (res) => {
  console.log('Réponse reçue! Status:', res.statusCode);
  process.exit(0);
});

req.on('error', (error) => {
  console.log('Erreur:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.log('TIMEOUT après 3 secondes');
  req.destroy();
  process.exit(1);
});

req.setTimeout(3000);

console.log('Envoi de la requête CONNECT vers simplaza.org:443...');
req.end();
