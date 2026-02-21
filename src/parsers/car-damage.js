const { HEADER_SIZE } = require('./header');

const CAR_DAMAGE_SIZE = 62;

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
      engineBlown:          buf.readUInt8(offset + 56) === 1,
      engineSeized:         buf.readUInt8(offset + 57) === 1,
    });
  }

  return cars;
}

module.exports = { parseCarDamage };
