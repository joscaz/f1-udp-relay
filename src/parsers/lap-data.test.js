const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseLapData } = require('./lap-data');
const { HEADER_SIZE } = require('./header');

const LAP_DATA_SIZE = 57;

function buildLapDataPacket(perCarWriter) {
  const buf = Buffer.alloc(HEADER_SIZE + 22 * LAP_DATA_SIZE);
  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + i * LAP_DATA_SIZE;
    perCarWriter(buf, offset, i);
  }
  return buf;
}

describe('parseLapData', () => {
  it('returns 22 entries from a full-sized packet', () => {
    const buf = buildLapDataPacket(() => {});
    assert.equal(parseLapData(buf).length, 22);
  });

  it('maps known offsets to friendly fields', () => {
    const buf = buildLapDataPacket((b, offset, i) => {
      b.writeUInt32LE(65432, offset); // lastLapTimeMS -> 1:05.432
      b.writeUInt32LE(12345, offset + 4); // currentLapTimeMS
      b.writeFloatLE(1234.5, offset + 20); // lapDistance
      b.writeUInt8(i + 1, offset + 32); // carPosition 1..22
      b.writeUInt8(i, offset + 33); // currentLapNum
      b.writeUInt8(1, offset + 34); // pitStatus
      b.writeUInt8(2, offset + 36); // sector = S3
      b.writeUInt8(1, offset + 37); // currentLapInvalid
    });

    const cars = parseLapData(buf);

    assert.equal(cars[0].carIndex, 0);
    assert.equal(cars[0].carPosition, 1);
    assert.equal(cars[0].lastLapTimeMS, 65432);
    assert.equal(cars[0].lastLapTime, '1:05.432');
    assert.equal(cars[0].sector, 2);
    assert.equal(cars[0].pitStatus, 1);
    assert.equal(cars[0].currentLapInvalid, true);
    assert.ok(Math.abs(cars[0].lapDistance - 1234.5) < 0.1);
    assert.equal(cars[21].carPosition, 22);
  });

  it('breaks early when the buffer is shorter than 22 cars', () => {
    const buf = Buffer.alloc(HEADER_SIZE + 5 * LAP_DATA_SIZE);
    assert.equal(parseLapData(buf).length, 5);
  });

  it('formats zero times as null', () => {
    const buf = buildLapDataPacket(() => {});
    const car = parseLapData(buf)[0];
    assert.equal(car.lastLapTime, null);
    assert.equal(car.currentLapTime, null);
    assert.equal(car.s1Time, null);
    assert.equal(car.s2Time, null);
  });

  it('formats positive deltas with seconds and ms parts', () => {
    const buf = buildLapDataPacket((b, offset) => {
      b.writeUInt16LE(234, offset + 14); // deltaFront ms part
      b.writeUInt8(0, offset + 16); // deltaFront minutes
      b.writeUInt16LE(400, offset + 17); // deltaLeader ms part
      b.writeUInt8(1, offset + 19); // deltaLeader minutes
    });
    const car = parseLapData(buf)[0];
    assert.equal(car.deltaToFront, '+0.234');
    assert.equal(car.deltaToLeader, '+1:00.400');
  });
});
