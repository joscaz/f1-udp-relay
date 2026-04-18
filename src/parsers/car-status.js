const { HEADER_SIZE } = require('./header');

/**
 * CarStatusData: 55 bytes per car
 *
 * Offset | Type   | Field
 * 0      | uint8  | tractionControl
 * 1      | uint8  | antiLockBrakes
 * 2      | uint8  | fuelMix
 * 3      | uint8  | frontBrakeBias
 * 4      | uint8  | pitLimiterStatus
 * 5      | float  | fuelInTank
 * 9      | float  | fuelCapacity
 * 13     | float  | fuelRemainingLaps
 * 17     | uint16 | maxRPM
 * 19     | uint16 | idleRPM
 * 21     | uint8  | maxGears
 * 22     | uint8  | drsAllowed
 * 23     | uint16 | drsActivationDistance
 * 25     | uint8  | actualTyreCompound
 * 26     | uint8  | visualTyreCompound
 * 27     | uint8  | tyresAgeLaps
 * 28     | int8   | vehicleFiaFlags
 * 29     | float  | enginePowerICE
 * 33     | float  | enginePowerMGUK
 * 37     | float  | ersStoreEnergy
 * 41     | uint8  | ersDeployMode
 * 42     | float  | ersHarvestedThisLapMGUK
 * 46     | float  | ersHarvestedThisLapMGUH
 * 50     | float  | ersDeployedThisLap
 * 54     | uint8  | networkPaused
 */

const CAR_STATUS_SIZE = 55;

const TYRE_COMPOUND_MAP = {
  16: 'C5',
  17: 'C4',
  18: 'C3',
  19: 'C2',
  20: 'C1',
  21: 'C0',
  22: 'C6',
  7: 'Inter',
  8: 'Wet',
};

const TYRE_VISUAL_MAP = {
  16: 'Soft',
  17: 'Medium',
  18: 'Hard',
  7: 'Inter',
  8: 'Wet',
};

const ERS_DEPLOY_MODE = {
  0: 'None',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Overtake',
};

function parseCarStatus(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + i * CAR_STATUS_SIZE;
    if (offset + CAR_STATUS_SIZE > buf.length) break;

    const actualTyreCompoundId = buf.readUInt8(offset + 25);
    const visualTyreCompoundId = buf.readUInt8(offset + 26);
    const ersDeployModeId = buf.readUInt8(offset + 41);

    cars.push({
      carIndex: i,
      tractionControl: buf.readUInt8(offset),
      antiLockBrakes: buf.readUInt8(offset + 1) === 1,
      fuelMix: buf.readUInt8(offset + 2),
      frontBrakeBias: buf.readUInt8(offset + 3),
      pitLimiterStatus: buf.readUInt8(offset + 4) === 1,
      fuelInTank: Math.round(buf.readFloatLE(offset + 5) * 100) / 100,
      fuelCapacity: Math.round(buf.readFloatLE(offset + 9) * 100) / 100,
      fuelRemainingLaps: Math.round(buf.readFloatLE(offset + 13) * 10) / 10,
      maxRPM: buf.readUInt16LE(offset + 17),
      idleRPM: buf.readUInt16LE(offset + 19),
      drsAllowed: buf.readUInt8(offset + 22) === 1,
      drsActivationDistance: buf.readUInt16LE(offset + 23),
      actualTyreCompound: TYRE_COMPOUND_MAP[actualTyreCompoundId] || `ID${actualTyreCompoundId}`,
      visualTyreCompound: TYRE_VISUAL_MAP[visualTyreCompoundId] || `ID${visualTyreCompoundId}`,
      tyresAgeLaps: buf.readUInt8(offset + 27),
      vehicleFiaFlags: buf.readInt8(offset + 28),
      ersStoreEnergy: Math.round(buf.readFloatLE(offset + 37)),
      ersDeployMode: ERS_DEPLOY_MODE[ersDeployModeId] || 'Unknown',
      ersDeployedThisLap: Math.round(buf.readFloatLE(offset + 50)),
      networkPaused: buf.readUInt8(offset + 54) === 1,
    });
  }

  return cars;
}

module.exports = { parseCarStatus };
