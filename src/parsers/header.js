/**
 * PacketHeader - común a todos los paquetes de F1 25
 * Total: 29 bytes
 * 
 * Offset | Tipo   | Campo
 * 0      | uint16 | m_packetFormat (2025)
 * 2      | uint8  | m_gameYear
 * 3      | uint8  | m_gameMajorVersion
 * 4      | uint8  | m_gameMinorVersion
 * 5      | uint8  | m_packetVersion
 * 6      | uint8  | m_packetId  ← el más importante
 * 7      | uint64 | m_sessionUID
 * 15     | float  | m_sessionTime
 * 19     | uint32 | m_frameIdentifier
 * 23     | uint32 | m_overallFrameIdentifier
 * 27     | uint8  | m_playerCarIndex
 * 28     | uint8  | m_secondaryPlayerCarIndex
 */

function parseHeader(buf) {
  return {
    packetFormat:             buf.readUInt16LE(0),
    gameYear:                 buf.readUInt8(2),
    gameMajorVersion:         buf.readUInt8(3),
    gameMinorVersion:         buf.readUInt8(4),
    packetVersion:            buf.readUInt8(5),
    packetId:                 buf.readUInt8(6),
    sessionUID:               buf.readBigUInt64LE(7).toString(),
    sessionTime:              buf.readFloatLE(15),
    frameIdentifier:          buf.readUInt32LE(19),
    overallFrameIdentifier:   buf.readUInt32LE(23),
    playerCarIndex:           buf.readUInt8(27),
    secondaryPlayerCarIndex:  buf.readUInt8(28),
  };
}

const HEADER_SIZE = 29;

module.exports = { parseHeader, HEADER_SIZE };
