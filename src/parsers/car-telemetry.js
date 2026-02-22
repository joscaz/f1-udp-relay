const { HEADER_SIZE } = require('./header');

const CAR_TELEMETRY_SIZE = 60;

const WHEEL_LABELS = ['rearLeft', 'rearRight', 'frontLeft', 'frontRight'];

function parseCarTelemetry(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * CAR_TELEMETRY_SIZE);
    if (offset + CAR_TELEMETRY_SIZE > buf.length) break;

    const brakesTemp = [];
    const tyreSurfaceTemp = [];
    const tyreInnerTemp = [];
    const tyrePressure = [];
    const surfaceType = [];

    for (let w = 0; w < 4; w++) {
      brakesTemp.push(buf.readUInt16LE(offset + 22 + (w * 2)));
    }
    for (let w = 0; w < 4; w++) {
      tyreSurfaceTemp.push(buf.readUInt8(offset + 30 + w));
    }
    for (let w = 0; w < 4; w++) {
      tyreInnerTemp.push(buf.readUInt8(offset + 34 + w));
    }
    const engineTemperature = buf.readUInt16LE(offset + 38);
    for (let w = 0; w < 4; w++) {
      tyrePressure.push(Math.round(buf.readFloatLE(offset + 40 + (w * 4)) * 10) / 10);
    }
    for (let w = 0; w < 4; w++) {
      surfaceType.push(buf.readUInt8(offset + 56 + w));
    }

    cars.push({
      carIndex: i,
      speed:             buf.readUInt16LE(offset),
      throttle:          Math.round(buf.readFloatLE(offset + 2) * 100),
      steer:             Math.round(buf.readFloatLE(offset + 6) * 100),
      brake:             Math.round(buf.readFloatLE(offset + 10) * 100),
      clutch:            buf.readUInt8(offset + 14),
      gear:              buf.readInt8(offset + 15),
      engineRPM:         buf.readUInt16LE(offset + 16),
      drs:               buf.readUInt8(offset + 18) === 1,
      revLightsPercent:  buf.readUInt8(offset + 19),
      brakesTemp: {
        rearLeft:   brakesTemp[0],
        rearRight:  brakesTemp[1],
        frontLeft:  brakesTemp[2],
        frontRight: brakesTemp[3],
      },
      tyreSurfaceTemp: {
        rearLeft:   tyreSurfaceTemp[0],
        rearRight:  tyreSurfaceTemp[1],
        frontLeft:  tyreSurfaceTemp[2],
        frontRight: tyreSurfaceTemp[3],
      },
      tyreInnerTemp: {
        rearLeft:   tyreInnerTemp[0],
        rearRight:  tyreInnerTemp[1],
        frontLeft:  tyreInnerTemp[2],
        frontRight: tyreInnerTemp[3],
      },
      engineTemperature,
      tyrePressure: {
        rearLeft:   tyrePressure[0],
        rearRight:  tyrePressure[1],
        frontLeft:  tyrePressure[2],
        frontRight: tyrePressure[3],
      },
    });
  }

  return cars;
}

module.exports = { parseCarTelemetry };
