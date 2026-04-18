/**
 * Throttler: caps how often each message type can be forwarded to the
 * WebSocket server. Values are minimum intervals (ms) between sends.
 *
 * Defaults:
 *   - session       2 Hz  (game emits at 2 Hz already)
 *   - lap_data      10 Hz (downsampled from up to 60 Hz)
 *   - car_telemetry 10 Hz
 *   - car_status    10 Hz
 *   - car_damage    2 Hz  (changes slowly)
 *   - participants  0.2 Hz (game emits every ~5 s)
 *   - event         unthrottled (instantaneous signals, never drop)
 *   - lap_positions 1 Hz
 */

const INTERVALS = {
  session: 500,
  lap_data: 100,
  car_telemetry: 100,
  car_status: 100,
  car_damage: 500,
  participants: 5000,
  lap_positions: 1000,
};

class Throttler {
  constructor() {
    this._lastSent = {};
  }

  shouldSend(type) {
    if (!INTERVALS[type]) return true;

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

const singleton = new Throttler();
singleton.INTERVALS = INTERVALS;

module.exports = singleton;
module.exports.Throttler = Throttler;
module.exports.INTERVALS = INTERVALS;
