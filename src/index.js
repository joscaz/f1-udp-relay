require('dotenv').config();
const wsClient   = require('./ws-client');
const udpListener = require('./udp-listener');

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║    Formula Delta Relay v1.0.0          ║');
console.log('║    EA F1 25 → WebSocket Bridge         ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

const required = ['SERVER_URL', 'RELAY_TOKEN'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Falta la variable de entorno: ${key}`);
    console.error('   Copia .env.example a .env y configura los valores');
    process.exit(1);
  }
}

wsClient.connect();

udpListener.start();

process.on('SIGINT', () => {
  console.log('\n[Relay] Apagando...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Relay] Error no manejado:', err.message);
});
