const { parseArgs } = require('node:util');
const path = require('node:path');

require('dotenv').config({ quiet: true });

const pkg = require(path.join(__dirname, '..', 'package.json'));

function parseCliArgs(argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        'server-url': { type: 'string' },
        token: { type: 'string' },
        'udp-port': { type: 'string' },
        verbose: { type: 'boolean', default: false },
        silent: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      allowPositionals: false,
      strict: true,
    });
    return values;
  } catch (err) {
    console.error(`[config] ${err.message}`);
    console.error('Run with --help for usage.');
    process.exit(2);
  }
}

function printHelp() {
  const help = `
f1-udp-relay v${pkg.version}
Parse EA SPORTS F1 25 UDP telemetry and relay it to any WebSocket backend.

Usage:
  f1-udp-relay [options]

Options:
  --server-url <url>   WebSocket URL of the receiving server (required)
                       Example: wss://my-server.example.com
  --token <token>      Optional auth token sent as "x-relay-token" header
  --udp-port <port>    UDP port to listen on (default: 20777)
  --verbose            Log parsing errors and extra debug info
  --silent             Suppress per-interval stats output
  -h, --help           Show this help and exit
  -v, --version        Print version and exit

Environment variables (fallbacks, lower precedence than CLI flags):
  SERVER_URL, RELAY_TOKEN, UDP_PORT

Docs & source:
  ${pkg.homepage}
`;
  process.stdout.write(help);
}

function loadConfig(argv) {
  const cli = parseCliArgs(argv);

  if (cli.help) {
    printHelp();
    process.exit(0);
  }
  if (cli.version) {
    process.stdout.write(`${pkg.version}\n`);
    process.exit(0);
  }

  const serverUrl = cli['server-url'] || process.env.SERVER_URL || '';
  const token = cli.token || process.env.RELAY_TOKEN || '';
  const udpPortRaw = cli['udp-port'] || process.env.UDP_PORT || '20777';
  const udpPort = Number.parseInt(udpPortRaw, 10);

  if (!serverUrl) {
    console.error('[config] Missing required --server-url (or SERVER_URL env var).');
    console.error('         Run with --help for usage.');
    process.exit(1);
  }

  if (!Number.isFinite(udpPort) || udpPort <= 0 || udpPort > 65535) {
    console.error(`[config] Invalid UDP port: "${udpPortRaw}" (must be 1-65535).`);
    process.exit(1);
  }

  return {
    serverUrl,
    token,
    udpPort,
    verbose: Boolean(cli.verbose),
    silent: Boolean(cli.silent),
    version: pkg.version,
  };
}

module.exports = { loadConfig };
