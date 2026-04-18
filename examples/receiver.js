/**
 * Minimal example WebSocket server that accepts a connection from
 * `f1-udp-relay` and pretty-prints every inbound message.
 *
 * Use this as a reference for writing your own backend — it documents the
 * expected message shape in code.
 *
 * Run:
 *   node examples/receiver.js
 *
 * Then in another terminal:
 *   SERVER_URL=ws://localhost:3003 pnpm start
 */
const { WebSocketServer } = require('ws');

const PORT = Number.parseInt(process.env.RECEIVER_PORT || '3003', 10);
const wss = new WebSocketServer({ port: PORT });

console.log('');
console.log('========================================');
console.log('  Example receiver (for f1-udp-relay)');
console.log(`  ws://localhost:${PORT}`);
console.log('========================================');
console.log('');
console.log('Waiting for a relay connection...\n');

wss.on('connection', (ws, req) => {
  const token = req.headers['x-relay-token'];
  console.log(`[receiver] relay connected (token: ${token ? token.slice(0, 8) + '...' : 'none'})`);

  let messageCount = 0;

  ws.on('message', (raw) => {
    messageCount++;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.log(`  [raw] ${raw.toString().slice(0, 100)}`);
      return;
    }

    const { type, payload } = msg;
    const data = payload?.data;

    switch (type) {
      case 'relay_connected':
        console.log(
          `  [handshake] relay v${payload?.version} at ${new Date(payload?.timestamp).toISOString()}`,
        );
        break;

      case 'session_changed':
        console.log(`  [session_changed] new UID=${payload?.newSessionUID}`);
        break;

      case 'event':
        console.log(`  [event] ${data?.code} ${JSON.stringify(data?.details || {})}`);
        break;

      case 'lap_data': {
        const cars = data || [];
        const top3 = cars
          .filter((c) => c.carPosition >= 1 && c.carPosition <= 3)
          .sort((a, b) => a.carPosition - b.carPosition)
          .map(
            (c) =>
              `P${c.carPosition} car#${c.carIndex} lap${c.currentLapNum} ${c.lastLapTime || '--'}`,
          );
        console.log(`  [lap_data] top 3: ${top3.join(' | ')}`);
        break;
      }

      case 'session': {
        const s = data;
        console.log(
          `  [session] track=${s?.trackId} weather=${s?.weather} laps=${s?.totalLaps} safetyCar=${s?.safetyCarStatus}`,
        );
        break;
      }

      case 'participants': {
        const names = data?.participants
          ?.slice(0, 5)
          .map((d) => d.name)
          .join(', ');
        console.log(`  [participants] ${data?.numActiveCars} cars: ${names}...`);
        break;
      }

      case 'car_telemetry': {
        const cars = data || [];
        const first = cars.find((c) => c.speed > 0);
        if (first) {
          console.log(
            `  [car_telemetry] car#${first.carIndex} ${first.speed}km/h G${first.gear} ${first.engineRPM}rpm DRS:${first.drs}`,
          );
        }
        break;
      }

      default: {
        const preview = JSON.stringify(data)?.slice(0, 200);
        console.log(`  [${type}] ${preview || ''}`);
      }
    }

    if (messageCount % 50 === 0) {
      console.log(`\n--- ${messageCount} messages received ---\n`);
    }
  });

  ws.on('close', () => {
    console.log(`[receiver] relay disconnected (${messageCount} messages received)`);
  });
});

process.on('SIGINT', () => {
  console.log('\n[receiver] Shutting down...');
  wss.close();
  process.exit(0);
});
