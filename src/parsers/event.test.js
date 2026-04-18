const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseEvent } = require('./event');
const { HEADER_SIZE } = require('./header');

function buildEventPacket(code, writeDetails = () => {}) {
  const buf = Buffer.alloc(HEADER_SIZE + 4 + 32);
  buf.write(code, HEADER_SIZE, 4, 'utf8');
  writeDetails(buf, HEADER_SIZE + 4);
  return buf;
}

describe('parseEvent', () => {
  it('extracts the 4-byte event code', () => {
    const buf = buildEventPacket('SSTA');
    assert.equal(parseEvent(buf).code, 'SSTA');
  });

  it('parses FTLP (fastest lap) details', () => {
    const buf = buildEventPacket('FTLP', (b, off) => {
      b.writeUInt8(7, off);
      b.writeFloatLE(89.123, off + 1);
    });
    const evt = parseEvent(buf);
    assert.equal(evt.code, 'FTLP');
    assert.equal(evt.details.vehicleIdx, 7);
    assert.ok(Math.abs(evt.details.lapTime - 89.123) < 0.01);
  });

  it('parses PENA details with every documented field', () => {
    const buf = buildEventPacket('PENA', (b, off) => {
      b.writeUInt8(1, off);
      b.writeUInt8(12, off + 1);
      b.writeUInt8(4, off + 2);
      b.writeUInt8(255, off + 3);
      b.writeUInt8(5, off + 4);
      b.writeUInt8(18, off + 5);
      b.writeUInt8(0, off + 6);
    });
    const evt = parseEvent(buf);
    assert.deepEqual(evt.details, {
      penaltyType: 1,
      infringementType: 12,
      vehicleIdx: 4,
      otherVehicleIdx: 255,
      time: 5,
      lapNum: 18,
      placesGained: 0,
    });
  });

  it('returns empty details for valueless codes', () => {
    for (const code of ['SSTA', 'SEND', 'DRSE', 'DRSD', 'CHQF', 'LGOT', 'RDFL']) {
      assert.deepEqual(parseEvent(buildEventPacket(code)).details, {});
    }
  });

  it('stamps a wall-clock timestamp on every event', () => {
    const before = Date.now();
    const evt = parseEvent(buildEventPacket('SSTA'));
    assert.ok(evt.timestamp >= before);
  });
});
