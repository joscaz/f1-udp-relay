const dgram = require('dgram');
require('dotenv').config();

const { parseHeader }       = require('./parsers/header');
const { parseSession }      = require('./parsers/session');
const { parseLapData }      = require('./parsers/lap-data');
const { parseEvent }        = require('./parsers/event');
const { parseParticipants } = require('./parsers/participants');
const { parseCarTelemetry } = require('./parsers/car-telemetry');
const { parseCarStatus }    = require('./parsers/car-status');
const { parseCarDamage }    = require('./parsers/car-damage');
const wsClient              = require('./ws-client');
const throttler             = require('./throttler');

const UDP_PORT = parseInt(process.env.UDP_PORT || '20777');

const PACKET_MAP = {
  1:  { parser: parseSession,      type: 'session',       throttle: true },
  2:  { parser: parseLapData,      type: 'lap_data',      throttle: true },
  3:  { parser: parseEvent,        type: 'event',         throttle: false },
  4:  { parser: parseParticipants, type: 'participants',  throttle: true },
  6:  { parser: parseCarTelemetry, type: 'car_telemetry', throttle: true },
  7:  { parser: parseCarStatus,    type: 'car_status',    throttle: true },
  10: { parser: parseCarDamage,    type: 'car_damage',    throttle: true },
};

const IGNORED_PACKETS = new Set([0, 5, 8, 9, 12, 13, 14]);

let packetsReceived = 0;
let packetsSent = 0;
let lastSessionUID = null;

function start() {
  const socket = dgram.createSocket('udp4');

  socket.on('listening', () => {
    const addr = socket.address();
    console.log(`[UDP] Escuchando en ${addr.address}:${addr.port}`);
    console.log('[UDP] Esperando datos de EA F1 25...');
  });

  socket.on('message', (buf) => {
    packetsReceived++;

    try {
      if (buf.length < 29) return;

      const header = parseHeader(buf);

      if (IGNORED_PACKETS.has(header.packetId)) return;

      const packetInfo = PACKET_MAP[header.packetId];
      if (!packetInfo) return;

      if (lastSessionUID && lastSessionUID !== header.sessionUID) {
        console.log('[UDP] 🔄 Nueva sesión detectada');
        wsClient.send('session_changed', { newSessionUID: header.sessionUID });
        throttler.reset();
      }
      lastSessionUID = header.sessionUID;

      if (packetInfo.throttle && !throttler.shouldSend(packetInfo.type)) return;

      const data = packetInfo.parser(buf);

      wsClient.send(packetInfo.type, {
        sessionUID:  header.sessionUID,
        sessionTime: header.sessionTime,
        data,
      });

      packetsSent++;

    } catch (err) {
      if (process.env.DEBUG) {
        console.error('[UDP] Error de parseo:', err.message);
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[UDP] Error del socket:', err.message);
    process.exit(1);
  });

  socket.bind(UDP_PORT);

  setInterval(() => {
    const wsStatus = wsClient.getStatus();
    console.log(`[Stats] Paquetes recibidos: ${packetsReceived} | Enviados: ${packetsSent} | WS: ${wsStatus.isConnected ? '✅' : '❌'}`);
    packetsReceived = 0;
    packetsSent = 0;
  }, 30000);

  return socket;
}

module.exports = { start };
