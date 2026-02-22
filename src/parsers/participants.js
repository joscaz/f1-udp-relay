const { HEADER_SIZE } = require('./header');

const PARTICIPANT_SIZE = 57;

function parseParticipants(buf) {
  const numActiveCars = buf.readUInt8(HEADER_SIZE);
  const participants = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + 1 + (i * PARTICIPANT_SIZE);

    if (offset + PARTICIPANT_SIZE > buf.length) break;

    const aiControlled = buf.readUInt8(offset);
    const driverId     = buf.readUInt8(offset + 1);
    const networkId    = buf.readUInt8(offset + 2);
    const teamId       = buf.readUInt8(offset + 3);
    const myTeam       = buf.readUInt8(offset + 4);
    const raceNumber   = buf.readUInt8(offset + 5);
    const nationality  = buf.readUInt8(offset + 6);

    const nameBuffer = buf.slice(offset + 7, offset + 7 + 32);
    const nullIdx = nameBuffer.indexOf(0);
    const name = nameBuffer.toString('utf8', 0, nullIdx >= 0 ? nullIdx : 32).trim();

    const yourTelemetry  = buf.readUInt8(offset + 39);
    const showOnlineNames= buf.readUInt8(offset + 40);
    const techLevel      = buf.readUInt16LE(offset + 41);
    const platform       = buf.readUInt8(offset + 43);

    const r = buf.readUInt8(offset + 45);
    const g = buf.readUInt8(offset + 46);
    const b = buf.readUInt8(offset + 47);
    const liveryColor = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;

    participants.push({
      carIndex: i,
      aiControlled: aiControlled === 1,
      driverId,
      networkId,
      teamId,
      raceNumber,
      name: name || `Driver ${i}`,
      yourTelemetry: yourTelemetry === 1 ? 'public' : 'restricted',
      platform,
      liveryColor,
    });
  }

  return { numActiveCars, participants };
}

module.exports = { parseParticipants };
