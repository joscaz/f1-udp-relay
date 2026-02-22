/**
 * Diagnostic tool: captures one raw packet of each type from the game
 * and dumps hex + attempts to identify correct offsets.
 * 
 * Usage: node src/debug-dump.js
 * Run with the game active and sending UDP data.
 */
const dgram = require('dgram');
require('dotenv').config();

const { parseHeader, HEADER_SIZE } = require('./parsers/header');

const UDP_PORT = parseInt(process.env.UDP_PORT || '20777');
const socket = dgram.createSocket('udp4');

const PACKET_NAMES = {
  0: 'Motion', 1: 'Session', 2: 'LapData', 3: 'Event',
  4: 'Participants', 5: 'CarSetups', 6: 'CarTelemetry', 7: 'CarStatus',
  8: 'FinalClassification', 9: 'LobbyInfo', 10: 'CarDamage',
  11: 'SessionHistory', 12: 'TyreSets', 13: 'MotionEx',
  14: 'TimeTrial', 15: 'LapPositions',
};

const captured = {};
const TARGET_PACKETS = new Set([1, 2, 3, 4, 6, 7, 10]);

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║    Buffer Diagnostic Tool              ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`Escuchando en UDP :${UDP_PORT}...`);
console.log(`Esperando 1 paquete de cada tipo: ${[...TARGET_PACKETS].map(id => PACKET_NAMES[id]).join(', ')}\n`);

socket.on('message', (buf) => {
  if (buf.length < HEADER_SIZE) return;

  const header = parseHeader(buf);
  const id = header.packetId;

  if (!TARGET_PACKETS.has(id) || captured[id]) return;

  captured[id] = buf;
  const name = PACKET_NAMES[id] || `Unknown(${id})`;
  const dataSize = buf.length - HEADER_SIZE;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`CAPTURED: Packet ${id} (${name}) — Total: ${buf.length} bytes, Data: ${dataSize} bytes`);
  console.log(`${'='.repeat(70)}`);

  if (id === 2) dumpLapData(buf);
  else if (id === 4) dumpParticipants(buf);
  else if (id === 6) dumpCarTelemetry(buf);
  else if (id === 7) dumpCarStatus(buf);
  else if (id === 1) dumpSession(buf);
  else if (id === 10) dumpCarDamage(buf);
  else if (id === 3) dumpEvent(buf);

  // Check if we captured all
  const capturedCount = Object.keys(captured).length;
  if (capturedCount >= TARGET_PACKETS.size) {
    console.log(`\n\n${'*'.repeat(70)}`);
    console.log('ALL PACKETS CAPTURED! Summary:');
    console.log(`${'*'.repeat(70)}`);
    for (const [pid, pbuf] of Object.entries(captured)) {
      const pname = PACKET_NAMES[pid] || `Unknown(${pid})`;
      const pDataSize = pbuf.length - HEADER_SIZE;
      console.log(`  Packet ${pid} (${pname}): ${pbuf.length} total, ${pDataSize} data bytes`);
      if ([2, 6, 7, 10].includes(Number(pid))) {
        const perCar = pDataSize / 22;
        console.log(`    → Per car: ${pDataSize} / 22 = ${perCar.toFixed(2)} bytes`);
      }
    }
    console.log('\nDone! Press Ctrl+C to exit.');
  }
});

function dumpHex(buf, offset, length, label) {
  const slice = buf.slice(offset, offset + length);
  const hex = slice.toString('hex').match(/.{1,2}/g)?.join(' ') || '';
  console.log(`  ${label} [${offset}-${offset + length - 1}]: ${hex}`);
}

function dumpLapData(buf) {
  const dataSize = buf.length - HEADER_SIZE;
  const perCar = dataSize / 22;
  console.log(`  Data region: ${dataSize} bytes. Per car (÷22): ${perCar.toFixed(2)} bytes`);

  // Dump first 2 cars raw
  for (let car = 0; car < 2; car++) {
    const offset = HEADER_SIZE + (car * Math.floor(perCar));
    console.log(`\n  --- Car ${car} raw (first 64 bytes from offset ${offset}) ---`);
    dumpHex(buf, offset, Math.min(64, buf.length - offset), `car[${car}]`);

    // Try reading common fields at various offsets to find carPosition
    console.log(`  Searching for carPosition (expected 1-22):`);
    for (let b = 0; b < Math.min(Math.floor(perCar), 64); b++) {
      const val = buf.readUInt8(offset + b);
      if (val >= 1 && val <= 22) {
        const prev = b > 0 ? buf.readUInt8(offset + b - 1) : '?';
        const next = b + 1 < perCar ? buf.readUInt8(offset + b + 1) : '?';
        console.log(`    offset+${b}: ${val}  (prev:${prev}, next:${next})`);
      }
    }

    // Try reading uint32 at offsets 0 and 4 as lap times (should be ~60000-120000 for 1-2 min laps)
    console.log(`  Checking lap time candidates (uint32, expected ~60000-120000ms):`);
    for (let b = 0; b <= 16; b += 4) {
      if (offset + b + 4 <= buf.length) {
        const val = buf.readUInt32LE(offset + b);
        if (val > 30000 && val < 300000) {
          console.log(`    offset+${b}: ${val}ms (${formatTime(val)})`);
        }
      }
    }

    // Try reading floats for lapDistance (should be 0 - trackLength ~5000+)
    console.log(`  Checking float candidates for lapDistance (expected 0-7000):`);
    for (let b = 0; b <= 40; b += 4) {
      if (offset + b + 4 <= buf.length) {
        const val = buf.readFloatLE(offset + b);
        if (val > 0 && val < 10000 && isFinite(val)) {
          console.log(`    offset+${b}: ${val.toFixed(1)}`);
        }
      }
    }
  }
}

function dumpParticipants(buf) {
  const numActive = buf.readUInt8(HEADER_SIZE);
  const dataAfterCount = buf.length - HEADER_SIZE - 1;
  const perParticipant = dataAfterCount / 22;
  console.log(`  numActiveCars: ${numActive}`);
  console.log(`  Data after count: ${dataAfterCount} bytes. Per participant (÷22): ${perParticipant.toFixed(2)} bytes`);

  // Dump first 2 participants
  for (let p = 0; p < 2; p++) {
    const offset = HEADER_SIZE + 1 + (p * Math.floor(perParticipant));
    console.log(`\n  --- Participant ${p} raw (first 64 bytes from offset ${offset}) ---`);
    dumpHex(buf, offset, Math.min(64, buf.length - offset), `part[${p}]`);

    // Try to find ASCII name (look for printable chars)
    console.log(`  Scanning for name (ASCII strings):`);
    let nameStart = -1;
    let nameStr = '';
    for (let b = 0; b < Math.min(Math.floor(perParticipant), 64); b++) {
      const ch = buf.readUInt8(offset + b);
      if (ch >= 32 && ch <= 126) {
        if (nameStart < 0) nameStart = b;
        nameStr += String.fromCharCode(ch);
      } else if (nameStart >= 0 && nameStr.length >= 3) {
        console.log(`    offset+${nameStart} (len ${nameStr.length}): "${nameStr}"`);
        nameStart = -1;
        nameStr = '';
      } else {
        nameStart = -1;
        nameStr = '';
      }
    }
    if (nameStart >= 0 && nameStr.length >= 3) {
      console.log(`    offset+${nameStart} (len ${nameStr.length}): "${nameStr}"`);
    }
  }
}

function dumpCarTelemetry(buf) {
  const dataSize = buf.length - HEADER_SIZE;
  const perCar = dataSize / 22;
  console.log(`  Data region: ${dataSize} bytes. Per car (÷22): ${perCar.toFixed(2)} bytes`);

  for (let car = 0; car < 2; car++) {
    const offset = HEADER_SIZE + (car * Math.floor(perCar));
    console.log(`\n  --- Car ${car} raw (first 64 bytes from offset ${offset}) ---`);
    dumpHex(buf, offset, Math.min(64, buf.length - offset), `tel[${car}]`);

    // Speed should be uint16 100-350 km/h
    console.log(`  Checking uint16 for speed (expected 100-370):`);
    for (let b = 0; b <= 20; b += 2) {
      if (offset + b + 2 <= buf.length) {
        const val = buf.readUInt16LE(offset + b);
        if (val >= 50 && val <= 400) {
          console.log(`    offset+${b}: ${val} km/h`);
        }
      }
    }

    // RPM should be uint16 3000-15000
    console.log(`  Checking uint16 for RPM (expected 3000-15000):`);
    for (let b = 0; b <= 30; b += 2) {
      if (offset + b + 2 <= buf.length) {
        const val = buf.readUInt16LE(offset + b);
        if (val >= 3000 && val <= 15000) {
          console.log(`    offset+${b}: ${val} rpm`);
        }
      }
    }
  }
}

function dumpCarStatus(buf) {
  const dataSize = buf.length - HEADER_SIZE;
  const perCar = dataSize / 22;
  console.log(`  Data region: ${dataSize} bytes. Per car (÷22): ${perCar.toFixed(2)} bytes`);

  const offset = HEADER_SIZE;
  console.log(`\n  --- Car 0 raw (first 64 bytes) ---`);
  dumpHex(buf, offset, Math.min(64, buf.length - offset), 'status[0]');

  // Look for tyre compound IDs (16-22 for dry, 7-8 for wet)
  console.log(`  Checking for tyre compound IDs (7,8,16-22):`);
  for (let b = 0; b < Math.min(Math.floor(perCar), 64); b++) {
    const val = buf.readUInt8(offset + b);
    if ((val >= 16 && val <= 22) || val === 7 || val === 8) {
      const next = b + 1 < perCar ? buf.readUInt8(offset + b + 1) : '?';
      console.log(`    offset+${b}: ${val} (next: ${next})`);
    }
  }

  // Look for fuel floats (expected 5-110 kg)
  console.log(`  Checking floats for fuel (expected 5-110):`);
  for (let b = 0; b <= 30; b += 1) {
    if (offset + b + 4 <= buf.length) {
      const val = buf.readFloatLE(offset + b);
      if (val > 5 && val < 120 && isFinite(val)) {
        console.log(`    offset+${b}: ${val.toFixed(2)} kg`);
      }
    }
  }
}

function dumpSession(buf) {
  const dataSize = buf.length - HEADER_SIZE;
  console.log(`  Data region: ${dataSize} bytes`);
  console.log(`\n  --- First 32 bytes of session data ---`);
  dumpHex(buf, HEADER_SIZE, Math.min(32, dataSize), 'session');

  const offset = HEADER_SIZE;
  console.log(`  Byte-by-byte (first 20):`);
  for (let b = 0; b < 20 && offset + b < buf.length; b++) {
    const u8 = buf.readUInt8(offset + b);
    let extra = '';
    if (b <= 16 && offset + b + 2 <= buf.length) {
      const u16 = buf.readUInt16LE(offset + b);
      if (u16 > 100 && u16 < 10000) extra += ` u16=${u16}`;
    }
    console.log(`    [${b}] u8=${u8}${extra}`);
  }
}

function dumpCarDamage(buf) {
  const dataSize = buf.length - HEADER_SIZE;
  const perCar = dataSize / 22;
  console.log(`  Data region: ${dataSize} bytes. Per car (÷22): ${perCar.toFixed(2)} bytes`);

  const offset = HEADER_SIZE;
  console.log(`\n  --- Car 0 raw (first 64 bytes) ---`);
  dumpHex(buf, offset, Math.min(64, buf.length - offset), 'damage[0]');

  // Tyre wear should be floats 0-100
  console.log(`  Checking floats for tyre wear (expected 0-100):`);
  for (let b = 0; b <= 30; b += 4) {
    if (offset + b + 4 <= buf.length) {
      const val = buf.readFloatLE(offset + b);
      if (val >= 0 && val <= 100 && isFinite(val)) {
        console.log(`    offset+${b}: ${val.toFixed(2)}%`);
      }
    }
  }
}

function dumpEvent(buf) {
  const code = buf.toString('utf8', HEADER_SIZE, HEADER_SIZE + 4);
  console.log(`  Event code: "${code}"`);
  dumpHex(buf, HEADER_SIZE, Math.min(20, buf.length - HEADER_SIZE), 'event');
}

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

socket.on('listening', () => {
  console.log(`Listening on :${UDP_PORT}...\n`);
});

socket.bind(UDP_PORT);
