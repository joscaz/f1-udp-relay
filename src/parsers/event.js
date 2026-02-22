const { HEADER_SIZE } = require('./header');

function parseEvent(buf) {
  const code = buf.toString('utf8', HEADER_SIZE, HEADER_SIZE + 4);
  const detailsOffset = HEADER_SIZE + 4;

  let details = {};

  switch (code) {
    case 'FTLP':
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
        lapTime: buf.readFloatLE(detailsOffset + 1),
      };
      break;

    case 'RTMT':
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
        reason: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'PENA':
      details = {
        penaltyType:      buf.readUInt8(detailsOffset),
        infringementType: buf.readUInt8(detailsOffset + 1),
        vehicleIdx:       buf.readUInt8(detailsOffset + 2),
        otherVehicleIdx:  buf.readUInt8(detailsOffset + 3),
        time:             buf.readUInt8(detailsOffset + 4),
        lapNum:           buf.readUInt8(detailsOffset + 5),
        placesGained:     buf.readUInt8(detailsOffset + 6),
      };
      break;

    case 'SPTP':
      details = {
        vehicleIdx:               buf.readUInt8(detailsOffset),
        speed:                    buf.readFloatLE(detailsOffset + 1),
        isOverallFastest:         buf.readUInt8(detailsOffset + 5) === 1,
        isDriverFastest:          buf.readUInt8(detailsOffset + 6) === 1,
        fastestVehicleIdxInSession: buf.readUInt8(detailsOffset + 7),
        fastestSpeedInSession:    buf.readFloatLE(detailsOffset + 8),
      };
      break;

    case 'OVTK':
      details = {
        overtakingVehicleIdx:     buf.readUInt8(detailsOffset),
        beingOvertakenVehicleIdx: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'SCAR':
      details = {
        safetyCarType: buf.readUInt8(detailsOffset),
        eventType:     buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'COLL':
      details = {
        vehicle1Idx: buf.readUInt8(detailsOffset),
        vehicle2Idx: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'RCWN':
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
      };
      break;

    case 'BUTN':
      details = {
        buttonStatus: buf.readUInt32LE(detailsOffset),
      };
      break;

    case 'SSTA':
    case 'SEND':
    case 'DRSE':
    case 'DRSD':
    case 'CHQF':
    case 'LGOT':
    case 'RDFL':
      details = {};
      break;

    default:
      details = {};
  }

  return { code, details, timestamp: Date.now() };
}

module.exports = { parseEvent };
