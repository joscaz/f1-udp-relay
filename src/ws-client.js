const WebSocket = require('ws');

const RECONNECT_DELAY_MS = 3000;

function createWsClient({ url, token = '', relayVersion = '0.0.0' }) {
  let ws = null;
  let reconnectTimer = null;
  let isConnected = false;

  function connect() {
    console.log(`[ws] Connecting to ${url}...`);

    const headers = {};
    if (token) {
      headers['x-relay-token'] = token;
    }

    ws = new WebSocket(url, { headers });

    ws.on('open', () => {
      isConnected = true;
      console.log('[ws] Connected.');
      send('relay_connected', {
        timestamp: Date.now(),
        version: relayVersion,
      });
    });

    ws.on('close', (code) => {
      isConnected = false;
      console.log(`[ws] Disconnected (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS}ms...`);
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      isConnected = false;
      console.error('[ws] Error:', err.message);
      // 'close' will fire next and handle reconnect.
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        console.log('[ws] Message from server:', msg.type);
      } catch {
        // Ignore non-JSON inbound messages.
      }
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }

  function send(type, payload) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      ws.send(JSON.stringify({ type, payload }));
    } catch (err) {
      console.error('[ws] Send error:', err.message);
    }
  }

  function getStatus() {
    return { isConnected, url };
  }

  function close() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignore close errors on shutdown.
      }
    }
  }

  return { connect, send, getStatus, close };
}

module.exports = { createWsClient };
