#!/usr/bin/env node
const { loadConfig } = require('./config');
const { createWsClient } = require('./ws-client');
const { startUdpListener } = require('./udp-listener');

const config = loadConfig();

console.log('');
console.log('========================================');
console.log(`  f1-udp-relay v${config.version}`);
console.log('  EA F1 25  ->  WebSocket bridge');
console.log('========================================');
console.log('');

if (!config.token) {
  console.log('[config] No token provided. Connecting without the "x-relay-token" header.');
  console.log('         Pass --token <value> or set RELAY_TOKEN if your server requires auth.');
}

const wsClient = createWsClient({
  url: config.serverUrl,
  token: config.token,
  relayVersion: config.version,
});

wsClient.connect();

startUdpListener({
  port: config.udpPort,
  verbose: config.verbose,
  silent: config.silent,
  wsClient,
});

process.on('SIGINT', () => {
  console.log('\n[relay] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[relay] Shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[relay] Uncaught exception:', err.message);
});
