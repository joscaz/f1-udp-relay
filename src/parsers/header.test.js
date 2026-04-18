const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseHeader, HEADER_SIZE } = require('./header');

describe('parseHeader', () => {
  it('exports a 29-byte header size', () => {
    assert.equal(HEADER_SIZE, 29);
  });

  it('reads every documented field from a synthetic buffer', () => {
    const buf = Buffer.alloc(HEADER_SIZE);
    buf.writeUInt16LE(2025, 0);
    buf.writeUInt8(25, 2);
    buf.writeUInt8(1, 3);
    buf.writeUInt8(2, 4);
    buf.writeUInt8(3, 5);
    buf.writeUInt8(2, 6); // packetId = LapData
    buf.writeBigUInt64LE(12345678901234567890n, 7);
    buf.writeFloatLE(42.5, 15);
    buf.writeUInt32LE(1000, 19);
    buf.writeUInt32LE(2000, 23);
    buf.writeUInt8(4, 27);
    buf.writeUInt8(255, 28);

    const header = parseHeader(buf);

    assert.equal(header.packetFormat, 2025);
    assert.equal(header.gameYear, 25);
    assert.equal(header.gameMajorVersion, 1);
    assert.equal(header.gameMinorVersion, 2);
    assert.equal(header.packetVersion, 3);
    assert.equal(header.packetId, 2);
    assert.equal(header.sessionUID, '12345678901234567890');
    assert.ok(Math.abs(header.sessionTime - 42.5) < 0.001);
    assert.equal(header.frameIdentifier, 1000);
    assert.equal(header.overallFrameIdentifier, 2000);
    assert.equal(header.playerCarIndex, 4);
    assert.equal(header.secondaryPlayerCarIndex, 255);
  });

  it('stringifies the sessionUID to avoid precision loss', () => {
    const buf = Buffer.alloc(HEADER_SIZE);
    const big = 2n ** 63n + 123n;
    buf.writeBigUInt64LE(big, 7);
    assert.equal(parseHeader(buf).sessionUID, big.toString());
  });
});
