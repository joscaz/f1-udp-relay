const dgram = require('node:dgram');

const { parseHeader, HEADER_SIZE } = require('./parsers/header');
const { parseSession } = require('./parsers/session');
const { parseLapData } = require('./parsers/lap-data');
const { parseEvent } = require('./parsers/event');
const { parseParticipants } = require('./parsers/participants');
const { parseCarTelemetry } = require('./parsers/car-telemetry');
const { parseCarStatus } = require('./parsers/car-status');
const { parseCarDamage } = require('./parsers/car-damage');
const throttler = require('./throttler');

const PACKET_MAP = {
  1: { parser: parseSession, type: 'session', throttle: true },
  2: { parser: parseLapData, type: 'lap_data', throttle: true },
  3: { parser: parseEvent, type: 'event', throttle: false },
  4: { parser: parseParticipants, type: 'participants', throttle: true },
  6: { parser: parseCarTelemetry, type: 'car_telemetry', throttle: true },
  7: { parser: parseCarStatus, type: 'car_status', throttle: true },
  10: { parser: parseCarDamage, type: 'car_damage', throttle: true },
};

const IGNORED_PACKETS = new Set([0, 5, 8, 9, 11, 12, 13, 14, 15]);

const STATS_INTERVAL_MS = 30000;

function startUdpListener({ port, verbose = false, silent = false, wsClient }) {
  const socket = dgram.createSocket('udp4');

  let packetsReceived = 0;
  let packetsSent = 0;
  let lastSessionUID = null;

  socket.on('listening', () => {
    const addr = socket.address();
    console.log(`[udp] Listening on ${addr.address}:${addr.port}`);
    console.log('[udp] Waiting for EA F1 25 telemetry...');
  });

  socket.on('message', (buf) => {
    packetsReceived++;

    try {
      if (buf.length < HEADER_SIZE) return;

      const header = parseHeader(buf);

      if (IGNORED_PACKETS.has(header.packetId)) return;

      const packetInfo = PACKET_MAP[header.packetId];
      if (!packetInfo) return;

      if (lastSessionUID && lastSessionUID !== header.sessionUID) {
        console.log('[udp] New session detected.');
        wsClient.send('session_changed', { newSessionUID: header.sessionUID });
        throttler.reset();
      }
      lastSessionUID = header.sessionUID;

      if (packetInfo.throttle && !throttler.shouldSend(packetInfo.type)) return;

      const data = packetInfo.parser(buf);

      wsClient.send(packetInfo.type, {
        sessionUID: header.sessionUID,
        sessionTime: header.sessionTime,
        data,
      });

      packetsSent++;
    } catch (err) {
      if (verbose) {
        console.error('[udp] Parse error:', err.message);
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[udp] Socket error:', err.message);
    process.exit(1);
  });

  socket.bind(port);

  let statsTimer = null;
  if (!silent) {
    statsTimer = setInterval(() => {
      const wsStatus = wsClient.getStatus();
      const wsLabel = wsStatus.isConnected ? 'connected' : 'disconnected';
      console.log(`[stats] received=${packetsReceived} forwarded=${packetsSent} ws=${wsLabel}`);
      packetsReceived = 0;
      packetsSent = 0;
    }, STATS_INTERVAL_MS);
  }

  function close() {
    if (statsTimer) clearInterval(statsTimer);
    try {
      socket.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  }

  return { socket, close };
}

module.exports = { startUdpListener };
