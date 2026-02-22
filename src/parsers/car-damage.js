const { HEADER_SIZE } = require('./header');

/**
 * CarDamageData: 46 bytes per car
 *
 * Offset | Type      | Field
 * 0      | float[4]  | tyresWear (RL, RR, FL, FR) — 16 bytes
 * 16     | uint8[4]  | tyresDamage — 4 bytes
 * 20     | uint8[4]  | brakesDamage — 4 bytes
 * 24     | uint8[4]  | tyreBlisters — 4 bytes
 * 28     | uint8     | frontLeftWingDamage
 * 29     | uint8     | frontRightWingDamage
 * 30     | uint8     | rearWingDamage
 * 31     | uint8     | floorDamage
 * 32     | uint8     | diffuserDamage
 * 33     | uint8     | sidepodDamage
 * 34     | uint8     | drsFault
 * 35     | uint8     | ersFault
 * 36     | uint8     | gearBoxDamage
 * 37     | uint8     | engineDamage
 * 38-43  | uint8[6]  | engine wear (MGUH, ES, CE, ICE, MGUK, TC)
 * 44     | uint8     | engineBlown
 * 45     | uint8     | engineSeized
 */

const CAR_DAMAGE_SIZE = 46;

function parseCarDamage(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * CAR_DAMAGE_SIZE);
    if (offset + CAR_DAMAGE_SIZE > buf.length) break;

    const tyresWear = {
      rearLeft:   Math.round(buf.readFloatLE(offset) * 10) / 10,
      rearRight:  Math.round(buf.readFloatLE(offset + 4) * 10) / 10,
      frontLeft:  Math.round(buf.readFloatLE(offset + 8) * 10) / 10,
      frontRight: Math.round(buf.readFloatLE(offset + 12) * 10) / 10,
    };

    const tyresDamage = {
      rearLeft:   buf.readUInt8(offset + 16),
      rearRight:  buf.readUInt8(offset + 17),
      frontLeft:  buf.readUInt8(offset + 18),
      frontRight: buf.readUInt8(offset + 19),
    };

    const brakesDamage = {
      rearLeft:   buf.readUInt8(offset + 20),
      rearRight:  buf.readUInt8(offset + 21),
      frontLeft:  buf.readUInt8(offset + 22),
      frontRight: buf.readUInt8(offset + 23),
    };

    const tyreBlisters = {
      rearLeft:   buf.readUInt8(offset + 24),
      rearRight:  buf.readUInt8(offset + 25),
      frontLeft:  buf.readUInt8(offset + 26),
      frontRight: buf.readUInt8(offset + 27),
    };

    cars.push({
      carIndex: i,
      tyresWear,
      tyresDamage,
      brakesDamage,
      tyreBlisters,
      frontLeftWingDamage:  buf.readUInt8(offset + 28),
      frontRightWingDamage: buf.readUInt8(offset + 29),
      rearWingDamage:       buf.readUInt8(offset + 30),
      floorDamage:          buf.readUInt8(offset + 31),
      diffuserDamage:       buf.readUInt8(offset + 32),
      sidepodDamage:        buf.readUInt8(offset + 33),
      drsFault:             buf.readUInt8(offset + 34) === 1,
      ersFault:             buf.readUInt8(offset + 35) === 1,
      gearBoxDamage:        buf.readUInt8(offset + 36),
      engineDamage:         buf.readUInt8(offset + 37),
      engineBlown:          buf.readUInt8(offset + 44) === 1,
      engineSeized:         buf.readUInt8(offset + 45) === 1,
    });
  }

  return cars;
}

module.exports = { parseCarDamage };
