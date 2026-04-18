# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-18

Initial public release.

### Added

- UDP listener on port 20777 (configurable) with header dispatch.
- Parsers for packet ids 1 (session), 2 (lap data), 3 (event),
  4 (participants), 6 (car telemetry), 7 (car status), 10 (car damage).
- WebSocket client with optional `x-relay-token` auth header and
  automatic reconnect every 3 seconds.
- Per-type outbound throttler (see `src/throttler.js`).
- CLI flags: `--server-url`, `--token`, `--udp-port`, `--verbose`,
  `--silent`, `--help`, `--version`.
- `.env` support as a fallback for all flags.
- Minimal example receiver (`examples/receiver.js`).
- Diagnostic tool for verifying byte offsets (`tools/debug-dump.js`).
- Stable WebSocket protocol documented in
  [`docs/PROTOCOL.md`](./docs/PROTOCOL.md).

[Unreleased]: https://github.com/joscaz/formula-delta-relay/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/joscaz/formula-delta-relay/releases/tag/v0.1.0
