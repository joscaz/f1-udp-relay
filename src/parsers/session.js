const { HEADER_SIZE } = require('./header');

function parseSession(buf) {
  let offset = HEADER_SIZE;

  const data = {
    weather:              buf.readUInt8(offset),
    trackTemperature:     buf.readInt8(offset + 1),
    airTemperature:       buf.readInt8(offset + 2),
    totalLaps:            buf.readUInt8(offset + 3),
    trackLength:          buf.readUInt16LE(offset + 4),
    sessionType:          buf.readUInt8(offset + 6),
    trackId:              buf.readInt8(offset + 7),
    formula:              buf.readUInt8(offset + 8),
    sessionTimeLeft:      buf.readUInt16LE(offset + 9),
    sessionDuration:      buf.readUInt16LE(offset + 11),
    pitSpeedLimit:        buf.readUInt8(offset + 13),
    gamePaused:           buf.readUInt8(offset + 14),
    isSpectating:         buf.readUInt8(offset + 15),
    spectatorCarIndex:    buf.readUInt8(offset + 16),
  };

  // Saltar sliProNativeSupport (1) + numMarshalZones (1) + marshalZones (21 * 5 = 105)
  const safetyCarOffset = offset + 17 + 1 + 105;

  data.safetyCarStatus = buf.readUInt8(safetyCarOffset);
  data.networkGame     = buf.readUInt8(safetyCarOffset + 1);

  // Saltar numWeatherForecastSamples (1) + weatherForecastSamples (64 * 8 = 512) + forecastAccuracy (1) + aiDifficulty (1) + 3 linkIdentifiers (4*3=12)
  const pitOffset = safetyCarOffset + 2 + 1 + 512 + 1 + 1 + 12;

  data.pitStopWindowIdealLap  = buf.readUInt8(pitOffset);
  data.pitStopWindowLatestLap = buf.readUInt8(pitOffset + 1);
  data.pitStopRejoinPosition  = buf.readUInt8(pitOffset + 2);

  const sectorOffset = HEADER_SIZE + 724 - 8;
  data.sector2LapDistanceStart = buf.readFloatLE(sectorOffset);
  data.sector3LapDistanceStart = buf.readFloatLE(sectorOffset + 4);

  return data;
}

module.exports = { parseSession };
