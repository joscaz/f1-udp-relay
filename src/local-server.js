const { WebSocketServer } = require('ws');

const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║    Local Test Server                   ║');
console.log(`║    ws://localhost:${PORT}                  ║`);
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log('Esperando conexión del relay...\n');

wss.on('connection', (ws, req) => {
  const token = req.headers['x-relay-token'];
  console.log(`[Server] Relay conectado (token: ${token ? token.slice(0, 8) + '...' : 'none'})`);

  let messageCount = 0;

  ws.on('message', (raw) => {
    messageCount++;
    try {
      const msg = JSON.parse(raw);
      const dataPreview = JSON.stringify(msg.payload?.data)?.slice(0, 200);

      if (msg.type === 'event') {
        console.log(`\n  [EVENT] ${msg.payload?.data?.code} ${JSON.stringify(msg.payload?.data?.details)}`);
      } else if (msg.type === 'lap_data') {
        const cars = msg.payload?.data || [];
        const top3 = cars
          .filter(c => c.carPosition >= 1 && c.carPosition <= 3)
          .sort((a, b) => a.carPosition - b.carPosition)
          .map(c => `P${c.carPosition} car#${c.carIndex} Lap${c.currentLapNum} ${c.lastLapTime || '--'}`);
        console.log(`  [${msg.type}] Top 3: ${top3.join(' | ')}`);
      } else if (msg.type === 'session') {
        const s = msg.payload?.data;
        console.log(`  [session] Track:${s?.trackId} Weather:${s?.weather} Laps:${s?.totalLaps} SafetyCar:${s?.safetyCarStatus}`);
      } else if (msg.type === 'participants') {
        const p = msg.payload?.data;
        const names = p?.participants?.slice(0, 5).map(d => d.name).join(', ');
        console.log(`  [participants] ${p?.numActiveCars} cars: ${names}...`);
      } else if (msg.type === 'car_telemetry') {
        const cars = msg.payload?.data || [];
        const first = cars.find(c => c.speed > 0);
        if (first) console.log(`  [telemetry] car#${first.carIndex}: ${first.speed}km/h G${first.gear} ${first.engineRPM}rpm DRS:${first.drs}`);
      } else {
        console.log(`  [${msg.type}] ${dataPreview || ''}`);
      }

      if (messageCount % 50 === 0) {
        console.log(`\n--- ${messageCount} mensajes recibidos ---\n`);
      }
    } catch (e) {
      console.log(`  [raw] ${raw.toString().slice(0, 100)}`);
    }
  });

  ws.on('close', () => {
    console.log(`[Server] Relay desconectado (${messageCount} mensajes recibidos)`);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] Cerrando...');
  wss.close();
  process.exit(0);
});
