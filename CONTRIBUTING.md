# Contributing

Thanks for your interest in improving `f1-udp-relay`. The project is
intentionally small and has no commercial backer — every fix and idea
helps.

## Ground rules

- Be kind. See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Open an issue before starting a non-trivial change so we can align on
  scope.
- Keep PRs focused. One logical change per PR makes review faster.
- The relay's goal is to be a thin, reliable UDP → WebSocket bridge. We
  intentionally keep features minimal. If something belongs on the
  consumer side (overlays, storage, analytics), it probably shouldn't
  live here.

## Local setup

Requirements:

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 9 (`corepack enable` works)
- Optional: EA SPORTS F1 25 running on the same machine (or another
  machine on your LAN forwarding UDP to port 20777).

```sh
git clone https://github.com/joscaz/formula-delta-relay.git
cd formula-delta-relay
pnpm install
cp .env.example .env
```

### Running without the game

Terminal 1 — fake server:

```sh
pnpm receiver
```

Terminal 2 — relay in watch mode:

```sh
pnpm dev
```

You'll see `[ws] Connected.` once the two processes find each other.
Without a real F1 25 instance sending UDP you won't see telemetry, but
you can still verify the handshake and reconnect logic.

### Running with the game

Point the game's UDP telemetry at `127.0.0.1:20777` (see
[`README.md`](./README.md#game-setup-ea-sports-f1-25)), set
`SERVER_URL` in `.env`, then `pnpm start`.

## Testing and linting

```sh
pnpm test           # node --test
pnpm test:watch     # node --test --watch
pnpm lint           # eslint
pnpm format         # prettier --write
```

Tests use Node's built-in `node:test` runner and live next to the code
they cover (`src/**/*.test.js`). Prefer fixture-based tests over
integration with the live game — that is what `tools/debug-dump.js` is
for.

## Adding a new packet parser

1. Capture a raw packet with `node tools/debug-dump.js` to confirm byte
   layout.
2. Add `src/parsers/<name>.js` exporting `parseXxx(buf)`.
3. Register it in [`src/udp-listener.js`](./src/udp-listener.js)'s
   `PACKET_MAP`.
4. Decide a throttle interval in [`src/throttler.js`](./src/throttler.js)
   (or leave unthrottled for event-like packets).
5. Document the output shape in
   [`docs/PROTOCOL.md`](./docs/PROTOCOL.md).
6. Add a unit test covering at least a couple of offsets.

## Commit / PR conventions

- Use present-tense, imperative commit subjects
  (`add lap_positions parser`, not `added lap_positions parser`).
- Reference issues with `Fixes #nn` or `Refs #nn` when applicable.
- Update `CHANGELOG.md` under `## [Unreleased]` if your change is
  user-visible.

## Releasing (maintainers)

1. Bump the version in [`package.json`](./package.json) and move the
   `Unreleased` section of `CHANGELOG.md` under the new version header.
2. Tag: `git tag v0.2.0 && git push --tags`.
3. The `release` workflow builds the Windows `.exe`, attaches it to the
   GitHub Release, and (when the `NPM_TOKEN` secret is configured)
   publishes to npm.
