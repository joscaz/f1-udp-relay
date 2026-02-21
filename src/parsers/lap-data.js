const { HEADER_SIZE } = require('./header');

const LAP_DATA_SIZE = 60;

function parseLapData(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * LAP_DATA_SIZE);

    if (offset + LAP_DATA_SIZE > buf.length) break;

    const lastLapTimeMS        = buf.readUInt32LE(offset);
    const currentLapTimeMS     = buf.readUInt32LE(offset + 4);
    const sector1TimeMSPart    = buf.readUInt16LE(offset + 8);
    const sector1TimeMinutes   = buf.readUInt8(offset + 10);
    const sector2TimeMSPart    = buf.readUInt16LE(offset + 11);
    const sector2TimeMinutes   = buf.readUInt8(offset + 13);

    const deltaFrontMSPart     = buf.readUInt16LE(offset + 14);
    const deltaFrontMinutes    = buf.readUInt8(offset + 16);

    const deltaLeaderMSPart    = buf.readUInt16LE(offset + 17);
    const deltaLeaderMinutes   = buf.readUInt8(offset + 19);

    const lapDistance          = buf.readFloatLE(offset + 20);
    const totalDistance        = buf.readFloatLE(offset + 24);
    const safetyCarDelta       = buf.readFloatLE(offset + 28);
    const carPosition          = buf.readUInt8(offset + 32);
    const currentLapNum        = buf.readUInt8(offset + 33);
    const pitStatus            = buf.readUInt8(offset + 34);
    const numPitStops          = buf.readUInt8(offset + 35);
    const sector               = buf.readUInt8(offset + 36);
    const currentLapInvalid    = buf.readUInt8(offset + 37);
    const penalties            = buf.readUInt8(offset + 38);
    const totalWarnings        = buf.readUInt8(offset + 39);
    const cornerCuttingWarnings= buf.readUInt8(offset + 40);
    const numUnservedDT        = buf.readUInt8(offset + 41);
    const numUnservedSG        = buf.readUInt8(offset + 42);
    const gridPosition         = buf.readUInt8(offset + 43);
    const driverStatus         = buf.readUInt8(offset + 44);
    const resultStatus         = buf.readUInt8(offset + 45);
    const pitLaneTimerActive   = buf.readUInt8(offset + 46);
    const pitLaneTimeInLaneMS  = buf.readUInt16LE(offset + 47);
    const pitStopTimerMS       = buf.readUInt16LE(offset + 49);
    const pitStopShouldServePen= buf.readUInt8(offset + 51);
    const speedTrapFastestSpeed= buf.readFloatLE(offset + 52);
    const speedTrapFastestLap  = buf.readUInt8(offset + 56);

    const lastLapTime  = formatTime(lastLapTimeMS);
    const currentLapTime = formatTime(currentLapTimeMS);
    const deltaToFront = formatDelta(deltaFrontMinutes, deltaFrontMSPart);
    const deltaToLeader = formatDelta(deltaLeaderMinutes, deltaLeaderMSPart);
    const s1Time = formatSectorTime(sector1TimeMinutes, sector1TimeMSPart);
    const s2Time = formatSectorTime(sector2TimeMinutes, sector2TimeMSPart);

    cars.push({
      carIndex: i,
      carPosition,
      currentLapNum,
      lastLapTimeMS,
      lastLapTime,
      currentLapTime,
      s1Time,
      s2Time,
      deltaToFront,
      deltaToLeader,
      lapDistance,
      totalDistance,
      safetyCarDelta,
      pitStatus,
      numPitStops,
      sector,
      currentLapInvalid: currentLapInvalid === 1,
      penalties,
      totalWarnings,
      gridPosition,
      driverStatus,
      resultStatus,
      pitLaneTimerActive: pitLaneTimerActive === 1,
      pitLaneTimeInLaneMS,
      pitStopTimerMS,
      speedTrapFastestSpeed,
    });
  }

  return cars;
}

function formatTime(ms) {
  if (ms === 0) return null;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis  = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatDelta(minutes, msPart) {
  const totalMS = (minutes * 60000) + msPart;
  if (totalMS === 0) return null;
  if (minutes === 0) {
    const seconds = Math.floor(msPart / 1000);
    const millis  = msPart % 1000;
    return `+${seconds}.${String(millis).padStart(3, '0')}`;
  }
  return `+${formatTime(totalMS)}`;
}

function formatSectorTime(minutes, msPart) {
  if (msPart === 0 && minutes === 0) return null;
  const totalMS = (minutes * 60000) + msPart;
  return formatTime(totalMS);
}

module.exports = { parseLapData };
