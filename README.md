# f1-udp-relay

A small, dependency-light program that parses **EA SPORTS F1 25** UDP
telemetry and relays it as JSON to any WebSocket backend you point it at.

Think of it as the plumbing layer: it sits on the host PC running the
game, translates binary UDP packets into readable JSON, and forwards
them over a single WebSocket connection. That's it. No UI, no storage,
no opinions about what you do with the data.

Built originally for a private F1 league's control tower; released under
MIT so any league, streamer, or sim-racing project can use it.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](./.nvmrc)

---

## What it does

```
EA F1 25  ──UDP :20777──>  f1-udp-relay  ──WebSocket JSON──>  your server
```

- Listens on UDP port `20777` (configurable).
- Parses these F1 25 packets: `session`, `lap_data`, `event`,
  `participants`, `car_telemetry`, `car_status`, `car_damage`.
- Throttles per-type send rates so the WebSocket stays lean (see
  [defaults](./docs/PROTOCOL.md#throttling-defaults)).
- Auto-reconnects to the server every 3 s on disconnect.
- Emits a documented, stable JSON envelope — see
  [`docs/PROTOCOL.md`](./docs/PROTOCOL.md).

## What it is _not_

- Not a dashboard or overlay. Build that on top of the JSON feed.
- Not a data logger. Pipe the WebSocket somewhere and persist it there.
- Not a backend. You need to run your own WS server (or use one of
  your league's). A reference implementation is at
  [`examples/receiver.js`](./examples/receiver.js).

---

## Quickstart — for non-technical users (Windows `.exe`)

> Built artifacts will be attached to the GitHub Releases page once the
> first tagged release is published.

1. Download `f1-udp-relay-win-x64.exe` from
   [Releases](https://github.com/joscaz/formula-delta-relay/releases).
2. Put it in a folder next to a file called `.env` with:

   ```
   SERVER_URL=wss://your-league-server.example.com
   RELAY_TOKEN=optional-if-your-server-needs-it
   UDP_PORT=20777
   ```

3. Configure the game (see [Game setup](#game-setup-ea-sports-f1-25)
   below).
4. Double-click the `.exe` (or `start-relay.bat` if it ships with one).
   You should see `[ws] Connected.` and `[udp] Listening on 0.0.0.0:20777`.
5. Drive. The relay keeps running in the background.

No Node.js install required.

## Quickstart — for developers / league admins

Requirements: Node.js ≥ 18 and pnpm (`corepack enable` covers it).

```sh
git clone https://github.com/joscaz/formula-delta-relay.git
cd formula-delta-relay
pnpm install
cp .env.example .env            # edit values
pnpm start
```

Or invoke the CLI directly without a `.env`:

```sh
pnpm start -- --server-url=ws://localhost:3003 --token=optional --verbose
```

Using npm/pnpm globally once it's published:

```sh
npx f1-udp-relay --server-url=wss://your-server.example.com
```

### Development loop

Terminal 1 — dummy receiver that pretty-prints every message:

```sh
pnpm receiver
```

Terminal 2 — relay with hot reload:

```sh
pnpm dev
```

---

## Configuration

Settings can come from CLI flags (preferred) or environment variables
(via `.env` or the shell). CLI flags always win.

| Flag                 | Env var       | Default  | Notes                                      |
| -------------------- | ------------- | -------- | ------------------------------------------ |
| `--server-url <url>` | `SERVER_URL`  | —        | **Required.** `ws://…` or `wss://…`        |
| `--token <value>`    | `RELAY_TOKEN` | _(none)_ | Sent as `x-relay-token` header only if set |
| `--udp-port <port>`  | `UDP_PORT`    | `20777`  | Must match the game's setting              |
| `--verbose`          | —             | `false`  | Logs per-packet parse errors               |
| `--silent`           | —             | `false`  | Suppresses the 30 s stats line             |
| `--help`             | —             | —        | Show help                                  |
| `--version`          | —             | —        | Print version                              |

Your backend does not need to authenticate — the token is purely a
convenience for servers that want to verify which relay is connecting.

---

## Game setup (EA SPORTS F1 25)

Do this on the PC that runs the game, each time before a race:

1. Open F1 25.
2. **Game Options → Settings → UDP Telemetry Settings**.
3. Set:
   - UDP Telemetry: **On**
   - UDP Broadcast Mode: **Off**
   - UDP IP Address: `127.0.0.1` (or the IP of the machine running
     the relay, if it's a different PC on the LAN)
   - UDP Port: `20777`
   - UDP Send Rate: **20 Hz**
   - UDP Format: **2025**
   - Your Telemetry: **Public** _(required if you want the server to
     see car/fuel data for remote drivers)_
   - Show Online Names: **On**

---

## WebSocket protocol

See [`docs/PROTOCOL.md`](./docs/PROTOCOL.md) for the full spec,
including every message type, field, and throttling rule.

A minimal receiver looks like this (pseudocode):

```js
const wss = new WebSocketServer({ port: 3003 });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const { type, payload } = JSON.parse(raw);
    if (type === 'lap_data') {
      // payload.data is an array of 22 cars
    }
  });
});
```

A runnable version is in [`examples/receiver.js`](./examples/receiver.js).

---

## Project layout

```
.
├── src/
│   ├── index.js          # CLI entry point
│   ├── config.js         # CLI flag + env var parsing
│   ├── ws-client.js      # WebSocket client with reconnect
│   ├── udp-listener.js   # UDP socket and packet dispatch
│   ├── throttler.js      # Per-type rate limiter
│   └── parsers/          # One file per F1 25 packet id
├── examples/
│   └── receiver.js       # Reference WebSocket server
├── tools/
│   └── debug-dump.js     # Hex dump / offset verification tool
└── docs/
    └── PROTOCOL.md       # WebSocket protocol spec
```

---

## Compatibility

- **Game:** EA SPORTS F1 25 (`packetFormat = 2025`). Earlier titles use
  different offsets and are not supported.
- **Node.js:** ≥ 18.
- **OS:** tested on Windows; should work on macOS/Linux if you can get
  F1 25's UDP stream to the machine.

---

## Contributing

PRs, bug reports, and new packet parsers are very welcome. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup instructions and the
conventions used here.

## License

[MIT](./LICENSE) © 2026 José Carlos Zertuche

Not affiliated with or endorsed by Electronic Arts, Codemasters, or
the Formula 1 companies. F1 25 is a trademark of its respective owner.
