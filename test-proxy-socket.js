const net = require('net');

console.log('Test avec socket brut...');

const client = new net.Socket();

client.setTimeout(3000);

client.on('timeout', () => {
  console.log('TIMEOUT');
  client.destroy();
  process.exit(1);
});

client.on('data', (data) => {
  console.log('Réponse reçue:');
  console.log(data.toString());
  client.destroy();
  process.exit(0);
});

client.on('error', (err) => {
  console.log('Erreur:', err.message);
  process.exit(1);
});

client.connect(8081, '127.0.0.1', () => {
  console.log('Connecté au proxy, envoi de CONNECT...');
  client.write('CONNECT simplaza.org:443 HTTP/1.1\r\nHost: simplaza.org\r\n\r\n');
});
