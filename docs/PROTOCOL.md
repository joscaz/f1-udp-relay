# WebSocket Protocol

The relay opens a single outbound WebSocket connection to the URL you
configure (`SERVER_URL` / `--server-url`). It never accepts inbound
connections and never persists data.

This document is the contract. As long as your backend understands the
envelopes below, it can consume telemetry from this relay.

For a runnable reference implementation, see
[`examples/receiver.js`](../examples/receiver.js).

---

## Connection

- **Transport:** standard WebSocket (`ws://` or `wss://`).
- **Direction:** relay → server (the relay is the client).
- **Headers:**
  - `x-relay-token: <your-token>` — only attached when the relay is launched
    with a non-empty `--token` / `RELAY_TOKEN`. Your server can use this to
    authenticate relays. When no token is configured, the header is omitted.
- **Reconnection:** the relay automatically reconnects every ~3 seconds on
  disconnect. No explicit acknowledgments are required from the server.

The server may send JSON messages back to the relay; the relay currently
only logs them (`msg.type`) and does not act on them.

---

## Envelope

Every message the relay sends is JSON with this shape:

```json
{
  "type": "<string>",
  "payload": { ... }
}
```

For parsed telemetry packets, `payload` additionally carries session
context:

```json
{
  "type": "lap_data",
  "payload": {
    "sessionUID": "12345678901234567890",
    "sessionTime": 123.456,
    "data": [
      /* parser output */
    ]
  }
}
```

- `sessionUID` (string) — the current session's 64-bit UID, stringified to
  preserve precision. Changes when a new session begins.
- `sessionTime` (number, seconds) — the game's internal session clock at
  the moment the packet was received.
- `data` — the parser output for this packet type. Shape depends on
  `type` (see below).

---

## Message types

### `relay_connected`

Sent once immediately after the WebSocket opens. Treat it as the relay's
handshake.

```json
{
  "type": "relay_connected",
  "payload": {
    "timestamp": 1716854400000,
    "version": "0.1.0"
  }
}
```

### `session_changed`

Emitted when the relay notices the `sessionUID` change between two
consecutive UDP packets (e.g. the host starts a new race).

```json
{
  "type": "session_changed",
  "payload": { "newSessionUID": "98765432101234567890" }
}
```

---

### `session` (F1 25 packet id 1)

Track, weather, session type, safety car, pit window. Forwarded at up to
2 Hz.

`payload.data` fields:

| Field                     | Type     | Notes                                                                   |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| `weather`                 | `uint8`  | 0=clear, 1=light cloud, 2=overcast, 3=light rain, 4=heavy rain, 5=storm |
| `trackTemperature`        | `int8`   | °C                                                                      |
| `airTemperature`          | `int8`   | °C                                                                      |
| `totalLaps`               | `uint8`  |                                                                         |
| `trackLength`             | `uint16` | metres                                                                  |
| `sessionType`             | `uint8`  | 15 = Race (see F1 25 spec)                                              |
| `trackId`                 | `int8`   |                                                                         |
| `formula`                 | `uint8`  |                                                                         |
| `sessionTimeLeft`         | `uint16` | seconds                                                                 |
| `sessionDuration`         | `uint16` | seconds                                                                 |
| `pitSpeedLimit`           | `uint8`  | km/h                                                                    |
| `gamePaused`              | `uint8`  |                                                                         |
| `isSpectating`            | `uint8`  |                                                                         |
| `spectatorCarIndex`       | `uint8`  |                                                                         |
| `safetyCarStatus`         | `uint8`  | 0=none, 1=full, 2=virtual, 3=formation lap                              |
| `networkGame`             | `uint8`  |                                                                         |
| `pitStopWindowIdealLap`   | `uint8`  |                                                                         |
| `pitStopWindowLatestLap`  | `uint8`  |                                                                         |
| `pitStopRejoinPosition`   | `uint8`  |                                                                         |
| `sector2LapDistanceStart` | `float`  | metres                                                                  |
| `sector3LapDistanceStart` | `float`  | metres                                                                  |

### `lap_data` (packet id 2)

Per-car position, lap/sector times, deltas, pit status for all 22 slots.
Forwarded at up to 10 Hz.

`payload.data` is an array with up to 22 entries, each:

| Field                   | Type         | Notes                                                   |
| ----------------------- | ------------ | ------------------------------------------------------- |
| `carIndex`              | number       | 0–21 slot index                                         |
| `carPosition`           | number       | 1–22                                                    |
| `currentLapNum`         | number       |                                                         |
| `lastLapTimeMS`         | number       | last lap time in ms                                     |
| `lastLapTime`           | string\|null | formatted `"M:SS.mmm"`                                  |
| `currentLapTime`        | string\|null | formatted                                               |
| `s1Time`, `s2Time`      | string\|null | formatted sector times                                  |
| `deltaToFront`          | string\|null | e.g. `"+0.234"` or `"+1:02.345"`                        |
| `deltaToLeader`         | string\|null |                                                         |
| `lapDistance`           | number       | metres, may be negative pre-line                        |
| `totalDistance`         | number       | metres since session start                              |
| `safetyCarDelta`        | number       |                                                         |
| `pitStatus`             | number       | 0=none, 1=pitting, 2=in pit area                        |
| `numPitStops`           | number       |                                                         |
| `sector`                | number       | 0=S1, 1=S2, 2=S3                                        |
| `currentLapInvalid`     | boolean      |                                                         |
| `penalties`             | number       | seconds added                                           |
| `totalWarnings`         | number       |                                                         |
| `gridPosition`          | number       |                                                         |
| `driverStatus`          | number       | 0=garage, 1=flying lap, 2=in lap, 3=out lap, 4=on track |
| `resultStatus`          | number       | 0=invalid, 1=inactive, 2=active, 3=finished, ...        |
| `pitLaneTimerActive`    | boolean      |                                                         |
| `pitLaneTimeInLaneMS`   | number       |                                                         |
| `pitStopTimerMS`        | number       |                                                         |
| `speedTrapFastestSpeed` | number       | km/h                                                    |

### `event` (packet id 3)

Instantaneous signals (lights out, fastest lap, penalty, ...). **Never
throttled** — every event is forwarded.

```json
{
  "type": "event",
  "payload": {
    "sessionUID": "...",
    "sessionTime": 42.0,
    "data": {
      "code": "PENA",
      "details": { "penaltyType": 1, "vehicleIdx": 4, "timeAdded": 5, "lapNum": 12 },
      "timestamp": 1716854400000
    }
  }
}
```

Supported event codes and their `details` shape:

| Code   | Meaning         | `details` fields                                                                                              |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `SSTA` | Session started | `{}`                                                                                                          |
| `SEND` | Session ended   | `{}`                                                                                                          |
| `FTLP` | Fastest lap     | `{ vehicleIdx, lapTime }`                                                                                     |
| `RTMT` | Retirement      | `{ vehicleIdx, reason }`                                                                                      |
| `DRSE` | DRS enabled     | `{}`                                                                                                          |
| `DRSD` | DRS disabled    | `{}`                                                                                                          |
| `CHQF` | Chequered flag  | `{}`                                                                                                          |
| `LGOT` | Lights out      | `{}`                                                                                                          |
| `RDFL` | Red flag        | `{}`                                                                                                          |
| `PENA` | Penalty         | `{ penaltyType, infringementType, vehicleIdx, otherVehicleIdx, time, lapNum, placesGained }`                  |
| `SPTP` | Speed trap      | `{ vehicleIdx, speed, isOverallFastest, isDriverFastest, fastestVehicleIdxInSession, fastestSpeedInSession }` |
| `OVTK` | Overtake        | `{ overtakingVehicleIdx, beingOvertakenVehicleIdx }`                                                          |
| `SCAR` | Safety car      | `{ safetyCarType, eventType }`                                                                                |
| `COLL` | Collision       | `{ vehicle1Idx, vehicle2Idx }`                                                                                |
| `RCWN` | Race winner     | `{ vehicleIdx }`                                                                                              |
| `BUTN` | Button press    | `{ buttonStatus }`                                                                                            |

Unknown codes still pass through as `{ code, details: {}, timestamp }`.

### `participants` (packet id 4)

Driver roster. Emits at most every 5 seconds (matches the game's own
cadence).

```json
{
  "numActiveCars": 20,
  "participants": [
    {
      "carIndex": 0,
      "aiControlled": false,
      "driverId": 255,
      "networkId": 1,
      "teamId": 0,
      "raceNumber": 44,
      "name": "HAMILTON",
      "yourTelemetry": "public",
      "platform": 1,
      "liveryColor": "#00D2BE"
    }
  ]
}
```

### `car_telemetry` (packet id 6)

Speed, throttle/brake/steer, gear, RPM, DRS, tyre and brake temps, tyre
pressures. Array of up to 22 cars. Forwarded at up to 10 Hz.

Per car:

| Field               | Type                                             | Notes                     |
| ------------------- | ------------------------------------------------ | ------------------------- |
| `carIndex`          | number                                           |                           |
| `speed`             | number                                           | km/h                      |
| `throttle`, `brake` | number                                           | 0–100                     |
| `steer`             | number                                           | -100 to 100               |
| `clutch`            | number                                           |                           |
| `gear`              | number                                           | -1=R, 0=N, 1-8            |
| `engineRPM`         | number                                           |                           |
| `drs`               | boolean                                          |                           |
| `revLightsPercent`  | number                                           | 0–100                     |
| `brakesTemp`        | `{ frontLeft, frontRight, rearLeft, rearRight }` | °C                        |
| `tyreSurfaceTemp`   | same shape                                       | °C                        |
| `tyreInnerTemp`     | same shape                                       | °C                        |
| `engineTemperature` | number                                           | °C                        |
| `tyrePressure`      | same shape                                       | PSI, rounded to 1 decimal |

### `car_status` (packet id 7)

Fuel, tyres, ERS, DRS-allowed flag. Array of up to 22. Forwarded at up to
10 Hz.

Per car:

| Field                   | Type    | Notes                                         |
| ----------------------- | ------- | --------------------------------------------- |
| `tractionControl`       | number  | 0=off, 1=medium, 2=full                       |
| `antiLockBrakes`        | boolean |                                               |
| `fuelMix`               | number  | 0=lean, 1=standard, 2=rich, 3=max             |
| `frontBrakeBias`        | number  | %                                             |
| `pitLimiterStatus`      | boolean |                                               |
| `fuelInTank`            | number  | kg (0 when restricted)                        |
| `fuelCapacity`          | number  | kg                                            |
| `fuelRemainingLaps`     | number  | laps                                          |
| `maxRPM`, `idleRPM`     | number  |                                               |
| `drsAllowed`            | boolean |                                               |
| `drsActivationDistance` | number  | metres to next DRS zone (0 if none)           |
| `actualTyreCompound`    | string  | `C0`–`C6`, `Inter`, `Wet`                     |
| `visualTyreCompound`    | string  | `Soft` / `Medium` / `Hard` / `Inter` / `Wet`  |
| `tyresAgeLaps`          | number  |                                               |
| `vehicleFiaFlags`       | number  | -1=unknown, 0=none, 1=green, 2=blue, 3=yellow |
| `ersStoreEnergy`        | number  | Joules                                        |
| `ersDeployMode`         | string  | `None` / `Medium` / `Hotlap` / `Overtake`     |
| `ersDeployedThisLap`    | number  | Joules                                        |
| `networkPaused`         | boolean |                                               |

### `car_damage` (packet id 10)

Wear, damage percentages, mechanical faults. Array of up to 22.
Forwarded at up to 2 Hz.

Per car:

| Field                                                           | Type                                             | Notes |
| --------------------------------------------------------------- | ------------------------------------------------ | ----- |
| `tyresWear`                                                     | `{ frontLeft, frontRight, rearLeft, rearRight }` | %     |
| `tyresDamage`                                                   | same shape                                       | %     |
| `brakesDamage`                                                  | same shape                                       | %     |
| `tyreBlisters`                                                  | same shape                                       | %     |
| `frontLeftWingDamage`, `frontRightWingDamage`, `rearWingDamage` | number                                           | %     |
| `floorDamage`, `diffuserDamage`, `sidepodDamage`                | number                                           | %     |
| `drsFault`, `ersFault`                                          | boolean                                          |       |
| `gearBoxDamage`, `engineDamage`                                 | number                                           | %     |
| `engineBlown`, `engineSeized`                                   | boolean                                          |       |

---

## Throttling defaults

The relay caps per-type send rates to keep the WebSocket lean. Values are
**minimum intervals in milliseconds between outbound sends** of that
type; the game's own emission rate may be lower.

| Type            | Interval (ms) | Effective rate        |
| --------------- | ------------- | --------------------- |
| `session`       | 500           | 2 Hz                  |
| `lap_data`      | 100           | 10 Hz                 |
| `car_telemetry` | 100           | 10 Hz                 |
| `car_status`    | 100           | 10 Hz                 |
| `car_damage`    | 500           | 2 Hz                  |
| `participants`  | 5000          | 0.2 Hz                |
| `lap_positions` | 1000          | 1 Hz                  |
| `event`         | _unthrottled_ | every event forwarded |

The source of truth is [`src/throttler.js`](../src/throttler.js).

---

## Offsets & spec version

Offsets follow the official EA F1 25 UDP specification
(`packetFormat = 2025`). If a field ever looks wrong against real game
data, run:

```sh
node tools/debug-dump.js
```

to capture hex dumps of the raw packets and cross-check byte offsets.
