const WebSocket = require('ws');
require('dotenv').config();

const SERVER_URL   = process.env.SERVER_URL;
const RELAY_TOKEN  = process.env.RELAY_TOKEN;

let ws = null;
let reconnectTimer = null;
let isConnected = false;

function connect() {
  console.log(`[WS] Conectando a ${SERVER_URL}...`);

  ws = new WebSocket(SERVER_URL, {
    headers: {
      'x-relay-token': RELAY_TOKEN,
    }
  });

  ws.on('open', () => {
    isConnected = true;
    console.log('[WS] ✅ Conectado al server');
    send('relay_connected', { timestamp: Date.now(), version: '1.0.0' });
  });

  ws.on('close', (code, reason) => {
    isConnected = false;
    console.log(`[WS] ❌ Desconectado (${code}). Reconectando en 3s...`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    isConnected = false;
    console.error('[WS] Error:', err.message);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('[WS] Mensaje del server:', msg.type);
    } catch (e) {}
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function send(type, payload) {
  if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify({ type, payload }));
  } catch (err) {
    console.error('[WS] Error al enviar:', err.message);
  }
}

function getStatus() {
  return { isConnected, url: SERVER_URL };
}

module.exports = { connect, send, getStatus };
