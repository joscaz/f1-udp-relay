# Plan 1: formula-delta-relay
## Agente UDP → WebSocket para PC Windows del Host

Este es el punto de entrada de todo el sistema. Vive en la PC del host y es el único componente que tiene acceso directo a los datos del juego EA F1 25 vía UDP. Sin él, no hay datos. Su trabajo es simple pero crítico: traducir los paquetes binarios de EA F1 25 a JSON legible y entregarlos a la nube. No persiste nada, no tiene UI, no toma decisiones. Solo escucha, parsea y reenvía.

---

## Qué es este repositorio

`formula-delta-relay` es un programa Node.js que corre en la PC Windows del host durante cada carrera. Su única responsabilidad es:

1. Escuchar el puerto UDP 20777 donde EA F1 25 emite telemetría
2. Parsear los paquetes binarios usando la spec oficial de EA
3. Filtrar y reducir la frecuencia de datos (throttling)
4. Reenviar los datos parseados como JSON al `formula-delta-server` via WebSocket

---

## Estructura de archivos final

```
formula-delta-relay/
├── src/
│   ├── index.js              # Entry point
│   ├── udp-listener.js       # Socket UDP
│   ├── ws-client.js          # Conexión WebSocket al server
│   ├── throttler.js          # Control de frecuencia de envío
│   ├── parsers/
│   │   ├── header.js         # Parser del PacketHeader común
│   │   ├── session.js        # Packet ID 1
│   │   ├── lap-data.js       # Packet ID 2
│   │   ├── event.js          # Packet ID 3
│   │   ├── participants.js   # Packet ID 4
│   │   ├── car-telemetry.js  # Packet ID 6
│   │   ├── car-status.js     # Packet ID 7
│   │   ├── car-damage.js     # Packet ID 10
│   │   ├── session-history.js# Packet ID 11
│   │   └── lap-positions.js  # Packet ID 15
│   └── constants/
│       ├── teams.js
│       ├── tracks.js
│       ├── tyres.js
│       └── events.js
├── .env.example
├── package.json
└── README.md
```

---

## Paso 1 — Crear el repositorio (ya está creado)
Como el repositorio ya está creado, unicamente inicializa pnpm

---

## Paso 2 — Instalar dependencias
Nota: debes utilizar pnpm
```bash
pnpm add ws dotenv
pnpm add --save-dev nodemon
```

Solo 2 dependencias reales:
- `ws` — cliente WebSocket para conectar al server
- `dotenv` — para leer variables de entorno del archivo `.env`

No hay librería de parseo de F1. La escribimos nosotros usando la spec oficial, lo que nos da control total y compatibilidad garantizada con F1 25.

---

## Paso 3 — Crear `.env.example` y `.env`

Crea el archivo `.env.example` (este sí va al repositorio):

```
SERVER_URL=wss://tu-server.railway.app
RELAY_TOKEN=tu_token_secreto_aqui
UDP_PORT=20777
```

Luego crea `.env` (este NO va al repositorio, agrégalo al `.gitignore`):

```
SERVER_URL=wss://formula-delta-server.railway.app
RELAY_TOKEN=fd_relay_2025_secreto
UDP_PORT=20777
```

Crea `.gitignore`:

```
node_modules/
.env
dist/
*.exe
```

---

## Paso 4 — El PacketHeader parser

Cada paquete UDP del juego empieza con el mismo header de 29 bytes. Este parser lo necesitan todos los demás parsers.

**`src/parsers/header.js`**

```javascript
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
    // uint64 no tiene soporte nativo en Node < 12, usamos BigInt
    sessionUID:               buf.readBigUInt64LE(7).toString(),
    sessionTime:              buf.readFloatLE(15),
    frameIdentifier:          buf.readUInt32LE(19),
    overallFrameIdentifier:   buf.readUInt32LE(23),
    playerCarIndex:           buf.readUInt8(27),
    secondaryPlayerCarIndex:  buf.readUInt8(28),
  };
}

// El header siempre ocupa 29 bytes
const HEADER_SIZE = 29;

module.exports = { parseHeader, HEADER_SIZE };
```

---

## Paso 5 — Parser de Session (Packet ID 1)

Este paquete llega 2 veces por segundo. Contiene info del circuito, clima, safety car, etc.

**`src/parsers/session.js`**

```javascript
const { HEADER_SIZE } = require('./header');

function parseSession(buf) {
  let offset = HEADER_SIZE;

  const data = {
    weather:              buf.readUInt8(offset),     // 0=clear,1=light cloud,2=overcast,3=light rain,4=heavy rain,5=storm
    trackTemperature:     buf.readInt8(offset + 1),
    airTemperature:       buf.readInt8(offset + 2),
    totalLaps:            buf.readUInt8(offset + 3),
    trackLength:          buf.readUInt16LE(offset + 4),  // metros
    sessionType:          buf.readUInt8(offset + 6),     // 15=Race, ver appendix
    trackId:              buf.readInt8(offset + 7),      // ver constants/tracks.js
    formula:              buf.readUInt8(offset + 8),
    sessionTimeLeft:      buf.readUInt16LE(offset + 9),  // segundos
    sessionDuration:      buf.readUInt16LE(offset + 11), // segundos
    pitSpeedLimit:        buf.readUInt8(offset + 13),
    gamePaused:           buf.readUInt8(offset + 14),
    isSpectating:         buf.readUInt8(offset + 15),
    spectatorCarIndex:    buf.readUInt8(offset + 16),
  };

  // Saltar sliProNativeSupport (1) + numMarshalZones (1) + marshalZones (21 * 5 = 105)
  const safetyCarOffset = offset + 17 + 1 + 105;

  data.safetyCarStatus = buf.readUInt8(safetyCarOffset);    // 0=none,1=full,2=virtual,3=formation lap
  data.networkGame     = buf.readUInt8(safetyCarOffset + 1);

  // Para llegar a pitStopWindowIdealLap necesitamos saltar numWeatherForecastSamples (1) + weatherForecastSamples (64 * 8 = 512) + forecastAccuracy (1) + aiDifficulty (1) + 3 linkIdentifiers (4*3=12)
  const pitOffset = safetyCarOffset + 2 + 1 + 512 + 1 + 1 + 12;

  data.pitStopWindowIdealLap  = buf.readUInt8(pitOffset);
  data.pitStopWindowLatestLap = buf.readUInt8(pitOffset + 1);
  data.pitStopRejoinPosition  = buf.readUInt8(pitOffset + 2);

  // Sector distances (al final del struct, útil para el mapa)
  // sector2LapDistanceStart y sector3LapDistanceStart son los últimos 2 floats
  // Para no calcular cada offset manual, los leemos desde el final del buffer conocido
  // El struct total de SessionData es 753 - 29 (header) = 724 bytes de datos
  const sectorOffset = HEADER_SIZE + 724 - 8; // últimos 2 floats = 8 bytes
  data.sector2LapDistanceStart = buf.readFloatLE(sectorOffset);
  data.sector3LapDistanceStart = buf.readFloatLE(sectorOffset + 4);

  return data;
}

module.exports = { parseSession };
```

---

## Paso 6 — Parser de Lap Data (Packet ID 2)

El más importante para la torre de control. Contiene posición, gaps, sector times, pit status de los 22 autos.

**`src/parsers/lap-data.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// Cada struct LapData ocupa 60 bytes (según spec F1 25)
const LAP_DATA_SIZE = 60;

function parseLapData(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * LAP_DATA_SIZE);

    // Verificar que hay suficientes bytes
    if (offset + LAP_DATA_SIZE > buf.length) break;

    const lastLapTimeMS        = buf.readUInt32LE(offset);
    const currentLapTimeMS     = buf.readUInt32LE(offset + 4);
    const sector1TimeMSPart    = buf.readUInt16LE(offset + 8);
    const sector1TimeMinutes   = buf.readUInt8(offset + 10);
    const sector2TimeMSPart    = buf.readUInt16LE(offset + 11);
    const sector2TimeMinutes   = buf.readUInt8(offset + 13);

    // Delta to car in front
    const deltaFrontMSPart     = buf.readUInt16LE(offset + 14);
    const deltaFrontMinutes    = buf.readUInt8(offset + 16);

    // Delta to race leader
    const deltaLeaderMSPart    = buf.readUInt16LE(offset + 17);
    const deltaLeaderMinutes   = buf.readUInt8(offset + 19);

    const lapDistance          = buf.readFloatLE(offset + 20);
    const totalDistance        = buf.readFloatLE(offset + 24);
    const safetyCarDelta       = buf.readFloatLE(offset + 28);
    const carPosition          = buf.readUInt8(offset + 32);
    const currentLapNum        = buf.readUInt8(offset + 33);
    const pitStatus            = buf.readUInt8(offset + 34); // 0=none,1=pitting,2=in pit area
    const numPitStops          = buf.readUInt8(offset + 35);
    const sector               = buf.readUInt8(offset + 36); // 0=s1,1=s2,2=s3
    const currentLapInvalid    = buf.readUInt8(offset + 37);
    const penalties            = buf.readUInt8(offset + 38);
    const totalWarnings        = buf.readUInt8(offset + 39);
    const cornerCuttingWarnings= buf.readUInt8(offset + 40);
    const numUnservedDT        = buf.readUInt8(offset + 41);
    const numUnservedSG        = buf.readUInt8(offset + 42);
    const gridPosition         = buf.readUInt8(offset + 43);
    const driverStatus         = buf.readUInt8(offset + 44); // 0=garage,1=flying,2=in lap,3=out lap,4=on track
    const resultStatus         = buf.readUInt8(offset + 45); // 0=invalid,1=inactive,2=active,3=finished,...
    const pitLaneTimerActive   = buf.readUInt8(offset + 46);
    const pitLaneTimeInLaneMS  = buf.readUInt16LE(offset + 47);
    const pitStopTimerMS       = buf.readUInt16LE(offset + 49);
    const pitStopShouldServePen= buf.readUInt8(offset + 51);
    const speedTrapFastestSpeed= buf.readFloatLE(offset + 52);
    const speedTrapFastestLap  = buf.readUInt8(offset + 56);

    // Helpers para formatear tiempos
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

// Convierte milliseconds a string "M:SS.mmm"
function formatTime(ms) {
  if (ms === 0) return null;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis  = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// Combina minutes part + ms part en string "+S.mmm" o "+M:SS.mmm"
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
```

---

## Paso 7 — Parser de Event (Packet ID 3)

Este llega cuando ocurre algo notable. Su estructura varía según el tipo de evento.

**`src/parsers/event.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// Los 4 bytes después del header son el event string code
function parseEvent(buf) {
  const code = buf.toString('utf8', HEADER_SIZE, HEADER_SIZE + 4);
  const detailsOffset = HEADER_SIZE + 4;

  let details = {};

  switch (code) {
    case 'FTLP': // Fastest Lap
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
        lapTime: buf.readFloatLE(detailsOffset + 1),
      };
      break;

    case 'RTMT': // Retirement
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
        reason: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'PENA': // Penalty
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

    case 'SPTP': // Speed Trap
      details = {
        vehicleIdx:               buf.readUInt8(detailsOffset),
        speed:                    buf.readFloatLE(detailsOffset + 1),
        isOverallFastest:         buf.readUInt8(detailsOffset + 5) === 1,
        isDriverFastest:          buf.readUInt8(detailsOffset + 6) === 1,
        fastestVehicleIdxInSession: buf.readUInt8(detailsOffset + 7),
        fastestSpeedInSession:    buf.readFloatLE(detailsOffset + 8),
      };
      break;

    case 'OVTK': // Overtake
      details = {
        overtakingVehicleIdx:     buf.readUInt8(detailsOffset),
        beingOvertakenVehicleIdx: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'SCAR': // Safety Car
      details = {
        safetyCarType: buf.readUInt8(detailsOffset), // 0=none,1=full,2=virtual,3=formation
        eventType:     buf.readUInt8(detailsOffset + 1), // 0=deployed,1=returning,2=returned,3=resume
      };
      break;

    case 'COLL': // Collision
      details = {
        vehicle1Idx: buf.readUInt8(detailsOffset),
        vehicle2Idx: buf.readUInt8(detailsOffset + 1),
      };
      break;

    case 'RCWN': // Race Winner
      details = {
        vehicleIdx: buf.readUInt8(detailsOffset),
      };
      break;

    // Estos no tienen details relevantes, solo el código importa:
    case 'SSTA': // Session Started
    case 'SEND': // Session Ended
    case 'DRSE': // DRS Enabled
    case 'DRSD': // DRS Disabled
    case 'CHQF': // Chequered Flag
    case 'LGOT': // Lights Out
    case 'RDFL': // Red Flag
      details = {};
      break;

    default:
      details = {};
  }

  return { code, details, timestamp: Date.now() };
}

module.exports = { parseEvent };
```

---

## Paso 8 — Parser de Participants (Packet ID 4)

Llega cada 5 segundos. Lo necesitas para mapear vehicle index → nombre del piloto.

**`src/parsers/participants.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// ParticipantData size: 1 + 1 + 1 + 1 + 1 + 1 + 1 + 32 + 1 + 1 + 2 + 1 + 1 + (3*4) = 56 bytes
// Nota: m_numColours (1) + liveryColours (4 * 3 = 12), pero revisa el .txt de la spec para confirmar
const PARTICIPANT_SIZE = 56;

function parseParticipants(buf) {
  const numActiveCars = buf.readUInt8(HEADER_SIZE);
  const participants = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + 1 + (i * PARTICIPANT_SIZE);

    if (offset + PARTICIPANT_SIZE > buf.length) break;

    const aiControlled = buf.readUInt8(offset);
    const driverId     = buf.readUInt8(offset + 1);    // 255 si es network human
    const networkId    = buf.readUInt8(offset + 2);
    const teamId       = buf.readUInt8(offset + 3);
    const myTeam       = buf.readUInt8(offset + 4);
    const raceNumber   = buf.readUInt8(offset + 5);
    const nationality  = buf.readUInt8(offset + 6);

    // Nombre: 32 chars UTF-8 null-terminated
    const nameBuffer = buf.slice(offset + 7, offset + 7 + 32);
    const nullIdx = nameBuffer.indexOf(0);
    const name = nameBuffer.toString('utf8', 0, nullIdx >= 0 ? nullIdx : 32).trim();

    const yourTelemetry  = buf.readUInt8(offset + 39); // 0=restricted,1=public
    const showOnlineNames= buf.readUInt8(offset + 40);
    const techLevel      = buf.readUInt16LE(offset + 41);
    const platform       = buf.readUInt8(offset + 43); // 1=Steam,3=PS,4=Xbox

    // liveryColours: offset + 44 (numColours) + offset + 45 (4 * RGB = 12 bytes)
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
```

---

## Paso 9 — Parser de Car Telemetry (Packet ID 6)

El más rico en datos por frame. Velocidad, throttle, freno, RPM, temperaturas, DRS.

**`src/parsers/car-telemetry.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// CarTelemetryData size:
// uint16 speed (2) + float throttle (4) + float steer (4) + float brake (4)
// + uint8 clutch (1) + int8 gear (1) + uint16 engineRPM (2) + uint8 drs (1)
// + uint8 revLightsPercent (1) + uint16 revLightsBitValue (2)
// + uint16[4] brakesTemperature (8) + uint8[4] tyresSurfaceTemp (4)
// + uint8[4] tyresInnerTemp (4) + uint16 engineTemperature (2)
// + float[4] tyresPressure (16) + uint8[4] surfaceType (4)
// = 60 bytes
const CAR_TELEMETRY_SIZE = 60;

// Wheel array order: 0=RL, 1=RR, 2=FL, 3=FR
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

    // Brakes temp: 4 * uint16 = 8 bytes
    for (let w = 0; w < 4; w++) {
      brakesTemp.push(buf.readUInt16LE(offset + 26 + (w * 2)));
    }
    // Tyre surface temp: 4 * uint8 = 4 bytes
    for (let w = 0; w < 4; w++) {
      tyreSurfaceTemp.push(buf.readUInt8(offset + 34 + w));
    }
    // Tyre inner temp: 4 * uint8 = 4 bytes
    for (let w = 0; w < 4; w++) {
      tyreInnerTemp.push(buf.readUInt8(offset + 38 + w));
    }
    // Engine temp: uint16 at offset + 42
    const engineTemperature = buf.readUInt16LE(offset + 42);
    // Tyre pressure: 4 * float = 16 bytes
    for (let w = 0; w < 4; w++) {
      tyrePressure.push(Math.round(buf.readFloatLE(offset + 44 + (w * 4)) * 10) / 10);
    }
    // Surface type: 4 * uint8 = 4 bytes
    for (let w = 0; w < 4; w++) {
      surfaceType.push(buf.readUInt8(offset + 60 + w));
    }

    cars.push({
      carIndex: i,
      speed:             buf.readUInt16LE(offset),       // km/h
      throttle:          Math.round(buf.readFloatLE(offset + 2) * 100),  // 0-100%
      steer:             Math.round(buf.readFloatLE(offset + 6) * 100),  // -100 a 100%
      brake:             Math.round(buf.readFloatLE(offset + 10) * 100), // 0-100%
      clutch:            buf.readUInt8(offset + 14),
      gear:              buf.readInt8(offset + 15),       // -1=R, 0=N, 1-8
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
```

---

## Paso 10 — Parser de Car Status (Packet ID 7)

Combustible, neumáticos, ERS, DRS allowed.

**`src/parsers/car-status.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// CarStatusData size: ~55 bytes (revisar con la spec detallada)
const CAR_STATUS_SIZE = 55;

const TYRE_COMPOUND_MAP = {
  16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1',
  21: 'C0', 22: 'C6', 7: 'Inter', 8: 'Wet',
};

const TYRE_VISUAL_MAP = {
  16: 'Soft', 17: 'Medium', 18: 'Hard', 7: 'Inter', 8: 'Wet',
};

const ERS_DEPLOY_MODE = {
  0: 'None', 1: 'Medium', 2: 'Hotlap', 3: 'Overtake',
};

function parseCarStatus(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * CAR_STATUS_SIZE);
    if (offset + CAR_STATUS_SIZE > buf.length) break;

    const actualTyreCompoundId = buf.readUInt8(offset + 17);
    const visualTyreCompoundId = buf.readUInt8(offset + 18);
    const ersDeployModeId      = buf.readUInt8(offset + 28);

    cars.push({
      carIndex: i,
      tractionControl:    buf.readUInt8(offset),      // 0=off,1=medium,2=full
      antiLockBrakes:     buf.readUInt8(offset + 1) === 1,
      fuelMix:            buf.readUInt8(offset + 2),  // 0=lean,1=standard,2=rich,3=max
      frontBrakeBias:     buf.readUInt8(offset + 3),  // % (0 si restricted)
      pitLimiterStatus:   buf.readUInt8(offset + 4) === 1,
      fuelInTank:         Math.round(buf.readFloatLE(offset + 5) * 100) / 100,   // kg (0 si restricted)
      fuelCapacity:       Math.round(buf.readFloatLE(offset + 9) * 100) / 100,
      fuelRemainingLaps:  Math.round(buf.readFloatLE(offset + 13) * 10) / 10,    // laps (0 si restricted)
      maxRPM:             buf.readUInt16LE(offset + 17),
      idleRPM:            buf.readUInt16LE(offset + 19),
      maxGears:           buf.readUInt8(offset + 21),
      drsAllowed:         buf.readUInt8(offset + 22) === 1,
      drsActivationDistance: buf.readUInt16LE(offset + 23), // 0=no disponible, X=en X metros
      actualTyreCompound: TYRE_COMPOUND_MAP[actualTyreCompoundId] || `ID${actualTyreCompoundId}`,
      visualTyreCompound: TYRE_VISUAL_MAP[visualTyreCompoundId] || `ID${visualTyreCompoundId}`,
      tyresAgeLaps:       buf.readUInt8(offset + 25),
      vehicleFiaFlags:    buf.readInt8(offset + 26),  // -1=unknown,0=none,1=green,2=blue,3=yellow
      ersStoreEnergy:     Math.round(buf.readFloatLE(offset + 31)),   // Joules (0 si restricted)
      ersDeployMode:      ERS_DEPLOY_MODE[ersDeployModeId] || 'Unknown',
      ersDeployedThisLap: Math.round(buf.readFloatLE(offset + 40)),   // Joules
      networkPaused:      buf.readUInt8(offset + 54) === 1,
    });
  }

  return cars;
}

module.exports = { parseCarStatus };
```

---

## Paso 11 — Parser de Car Damage (Packet ID 10)

Llega 10 veces por segundo. Desgaste, daños, faults.

**`src/parsers/car-damage.js`**

```javascript
const { HEADER_SIZE } = require('./header');

// CarDamageData size: ~62 bytes
const CAR_DAMAGE_SIZE = 62;

function parseCarDamage(buf) {
  const cars = [];

  for (let i = 0; i < 22; i++) {
    const offset = HEADER_SIZE + (i * CAR_DAMAGE_SIZE);
    if (offset + CAR_DAMAGE_SIZE > buf.length) break;

    // tyresWear: 4 * float = 16 bytes
    const tyresWear = {
      rearLeft:   Math.round(buf.readFloatLE(offset) * 10) / 10,
      rearRight:  Math.round(buf.readFloatLE(offset + 4) * 10) / 10,
      frontLeft:  Math.round(buf.readFloatLE(offset + 8) * 10) / 10,
      frontRight: Math.round(buf.readFloatLE(offset + 12) * 10) / 10,
    };

    // tyresDamage: 4 * uint8 = 4 bytes at offset + 16
    const tyresDamage = {
      rearLeft:   buf.readUInt8(offset + 16),
      rearRight:  buf.readUInt8(offset + 17),
      frontLeft:  buf.readUInt8(offset + 18),
      frontRight: buf.readUInt8(offset + 19),
    };

    // brakesDamage: 4 * uint8 = 4 bytes at offset + 20
    const brakesDamage = {
      rearLeft:   buf.readUInt8(offset + 20),
      rearRight:  buf.readUInt8(offset + 21),
      frontLeft:  buf.readUInt8(offset + 22),
      frontRight: buf.readUInt8(offset + 23),
    };

    // tyreBlisters: 4 * uint8 = 4 bytes at offset + 24 (nuevo en F1 25)
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
```

---

## Paso 12 — Throttler

Controla la frecuencia máxima de envío por tipo de paquete para no saturar el WebSocket.

**`src/throttler.js`**

```javascript
/**
 * Throttler: controla que ciertos tipos de mensajes no se envíen
 * más frecuentemente de lo necesario.
 * 
 * Frecuencias definidas:
 * - session:      máximo 2/seg  (el juego ya lo manda a 2/seg)
 * - lap_data:     máximo 10/seg (reducimos de 60Hz a 10Hz)
 * - car_telemetry:máximo 10/seg
 * - car_status:   máximo 10/seg
 * - car_damage:   máximo 2/seg  (cambia lento)
 * - participants: máximo 1/seg  (el juego lo manda cada 5 seg)
 * - event:        siempre       (son instantáneos, nunca throttle)
 * - lap_positions:máximo 1/seg
 */

const INTERVALS = {
  session:       500,  // ms
  lap_data:      100,
  car_telemetry: 100,
  car_status:    100,
  car_damage:    500,
  participants:  5000,
  lap_positions: 1000,
};

class Throttler {
  constructor() {
    this._lastSent = {};
  }

  // Retorna true si este tipo de mensaje puede enviarse ahora
  shouldSend(type) {
    if (!INTERVALS[type]) return true; // sin restricción (ej: events)

    const now = Date.now();
    const last = this._lastSent[type] || 0;

    if (now - last >= INTERVALS[type]) {
      this._lastSent[type] = now;
      return true;
    }

    return false;
  }

  reset() {
    this._lastSent = {};
  }
}

module.exports = new Throttler();
```

---

## Paso 13 — WebSocket Client

Maneja la conexión persistente al `formula-delta-server` con reconexión automática.

**`src/ws-client.js`**

```javascript
const WebSocket = require('ws');
require('dotenv').config();

const SERVER_URL   = process.env.SERVER_URL;
const RELAY_TOKEN  = process.env.RELAY_TOKEN;

let ws = null;
let reconnectTimer = null;
let isConnected = false;

function connect() {
  console.log(`[WS] Conectando a ${SERVER_URL}...`);

  ws = new WebSocket(SERVER_URL, {
    headers: {
      'x-relay-token': RELAY_TOKEN,
    }
  });

  ws.on('open', () => {
    isConnected = true;
    console.log('[WS] ✅ Conectado al server');
    // Enviar handshake de identificación
    send('relay_connected', { timestamp: Date.now(), version: '1.0.0' });
  });

  ws.on('close', (code, reason) => {
    isConnected = false;
    console.log(`[WS] ❌ Desconectado (${code}). Reconectando en 3s...`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    isConnected = false;
    console.error('[WS] Error:', err.message);
    // No schedualeReconnect aquí, el evento 'close' lo maneja
  });

  ws.on('message', (data) => {
    // El server puede enviarnos comandos, ej: confirmar conexión
    try {
      const msg = JSON.parse(data);
      console.log('[WS] Mensaje del server:', msg.type);
    } catch (e) {}
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function send(type, payload) {
  if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify({ type, payload }));
  } catch (err) {
    console.error('[WS] Error al enviar:', err.message);
  }
}

function getStatus() {
  return { isConnected, url: SERVER_URL };
}

module.exports = { connect, send, getStatus };
```

---

## Paso 14 — UDP Listener

Escucha el puerto UDP del juego y despacha a los parsers correctos.

**`src/udp-listener.js`**

```javascript
const dgram = require('dgram');
require('dotenv').config();

const { parseHeader }       = require('./parsers/header');
const { parseSession }      = require('./parsers/session');
const { parseLapData }      = require('./parsers/lap-data');
const { parseEvent }        = require('./parsers/event');
const { parseParticipants } = require('./parsers/participants');
const { parseCarTelemetry } = require('./parsers/car-telemetry');
const { parseCarStatus }    = require('./parsers/car-status');
const { parseCarDamage }    = require('./parsers/car-damage');
const wsClient              = require('./ws-client');
const throttler             = require('./throttler');

const UDP_PORT = parseInt(process.env.UDP_PORT || '20777');

// Mapa de packet ID → { parser, type para WebSocket }
const PACKET_MAP = {
  1:  { parser: parseSession,      type: 'session',       throttle: true },
  2:  { parser: parseLapData,      type: 'lap_data',      throttle: true },
  3:  { parser: parseEvent,        type: 'event',         throttle: false }, // NUNCA throttle
  4:  { parser: parseParticipants, type: 'participants',  throttle: true },
  6:  { parser: parseCarTelemetry, type: 'car_telemetry', throttle: true },
  7:  { parser: parseCarStatus,    type: 'car_status',    throttle: true },
  10: { parser: parseCarDamage,    type: 'car_damage',    throttle: true },
  // Packet ID 15 (lap_positions) - implementar si se necesita el gráfico de posiciones
};

// Paquetes a ignorar completamente
const IGNORED_PACKETS = new Set([0, 5, 8, 9, 12, 13, 14]);

let packetsReceived = 0;
let packetsSent = 0;
let lastSessionUID = null;

function start() {
  const socket = dgram.createSocket('udp4');

  socket.on('listening', () => {
    const addr = socket.address();
    console.log(`[UDP] Escuchando en ${addr.address}:${addr.port}`);
    console.log('[UDP] Esperando datos de EA F1 25...');
  });

  socket.on('message', (buf) => {
    packetsReceived++;

    try {
      // Mínimo 29 bytes para leer el header
      if (buf.length < 29) return;

      const header = parseHeader(buf);

      // Ignorar paquetes que no necesitamos
      if (IGNORED_PACKETS.has(header.packetId)) return;

      const packetInfo = PACKET_MAP[header.packetId];
      if (!packetInfo) return;

      // Detectar cambio de sesión
      if (lastSessionUID && lastSessionUID !== header.sessionUID) {
        console.log('[UDP] 🔄 Nueva sesión detectada');
        wsClient.send('session_changed', { newSessionUID: header.sessionUID });
        throttler.reset();
      }
      lastSessionUID = header.sessionUID;

      // Throttle check
      if (packetInfo.throttle && !throttler.shouldSend(packetInfo.type)) return;

      // Parsear y enviar
      const data = packetInfo.parser(buf);

      wsClient.send(packetInfo.type, {
        sessionUID:  header.sessionUID,
        sessionTime: header.sessionTime,
        data,
      });

      packetsSent++;

    } catch (err) {
      // Silenciar errores de parseo individuales para no interrumpir el flujo
      if (process.env.DEBUG) {
        console.error('[UDP] Error de parseo:', err.message);
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[UDP] Error del socket:', err.message);
    process.exit(1);
  });

  // Bind al puerto UDP
  socket.bind(UDP_PORT);

  // Stats cada 30 segundos
  setInterval(() => {
    const wsStatus = wsClient.getStatus();
    console.log(`[Stats] Paquetes recibidos: ${packetsReceived} | Enviados: ${packetsSent} | WS: ${wsStatus.isConnected ? '✅' : '❌'}`);
    packetsReceived = 0;
    packetsSent = 0;
  }, 30000);

  return socket;
}

module.exports = { start };
```

---

## Paso 15 — Entry Point principal

**`src/index.js`**

```javascript
require('dotenv').config();
const wsClient   = require('./ws-client');
const udpListener = require('./udp-listener');

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║    Formula Delta Relay v1.0.0          ║');
console.log('║    EA F1 25 → WebSocket Bridge         ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

// Validar variables de entorno necesarias
const required = ['SERVER_URL', 'RELAY_TOKEN'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Falta la variable de entorno: ${key}`);
    console.error('   Copia .env.example a .env y configura los valores');
    process.exit(1);
  }
}

// 1. Conectar al WebSocket server
wsClient.connect();

// 2. Iniciar escucha UDP (el juego ya debe estar corriendo con UDP activado)
udpListener.start();

// 3. Manejar shutdown limpio
process.on('SIGINT', () => {
  console.log('\n[Relay] Apagando...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Relay] Error no manejado:', err.message);
  // No salir para mantener el relay activo
});
```

---

## Paso 16 — package.json final

```json
{
  "name": "formula-delta-relay",
  "version": "1.0.0",
  "description": "EA F1 25 UDP to WebSocket relay for Formula Delta",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "node src/test-parser.js"
  },
  "dependencies": {
    "ws": "^8.17.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

---

## Paso 17 — README para el host

Crea `README.md`:

```markdown
# Formula Delta Relay

Programa que transmite la telemetría de EA F1 25 al servidor de Formula Delta.

## Requisitos

- Node.js 16 o superior
- EA F1 25 corriendo en esta PC

## Configuración del juego (HACER ANTES DE CADA CARRERA)

1. Abre EA F1 25
2. Ve a **Game Options → Settings → UDP Telemetry Settings**
3. Configura:
   - UDP Telemetry: **On**
   - UDP Broadcast Mode: **Off**
   - UDP IP Address: **127.0.0.1**
   - UDP Port: **20777**
   - UDP Send Rate: **20Hz**
   - Your Telemetry: **Public** ← IMPORTANTE
   - Show online Names: **On** ← IMPORTANTE

## Instalación (solo la primera vez)

```bash
npm install
cp .env.example .env
# Edita .env con los valores que te dio el admin del torneo
```

## Uso

Antes de que empiece la carrera, abre una terminal y corre:

```bash
pnpm start
```

Verás esto cuando esté funcionando:
```
[WS] ✅ Conectado al server
[UDP] Escuchando en 0.0.0.0:20777
[UDP] Esperando datos de EA F1 25...
```

Para detener: `Ctrl+C`
```

---

## Paso 18 — Verificación local (sin server)

Antes de conectarte al server, puedes verificar que el relay parsea correctamente creando un script de prueba rápido `src/test-parser.js`:

```javascript
// Test básico del header parser con un buffer sintético
const { parseHeader } = require('./parsers/header');

// Crear un buffer de 29 bytes que simule un header de F1 25
const testBuf = Buffer.alloc(29);
testBuf.writeUInt16LE(2025, 0);  // packetFormat
testBuf.writeUInt8(25, 2);       // gameYear
testBuf.writeUInt8(1, 3);        // gameMajorVersion
testBuf.writeUInt8(0, 4);        // gameMinorVersion
testBuf.writeUInt8(1, 5);        // packetVersion
testBuf.writeUInt8(2, 6);        // packetId = LapData

const header = parseHeader(testBuf);
console.log('Header parseado:', header);
console.log('✅ Parser funcionando si no hay errores');
```

---

## Nota importante sobre offsets

Los offsets de cada struct están calculados según la spec oficial de EA. Si al probar con datos reales del juego notas que un valor parece incorrecto (por ejemplo, temperaturas de 0 cuando deberían ser ~90°C), lo más probable es que el offset esté un byte desfasado. El proceso de corrección es:

1. Loggea el buffer raw: `console.log(buf.slice(headerSize, headerSize + 20).toString('hex'))`
2. Compara byte a byte con la spec
3. Ajusta el offset

Esto pasa porque algunos structs tienen campos que cambian de versión a versión. La spec del `.txt` adjunto es la fuente de verdad para F1 25.
