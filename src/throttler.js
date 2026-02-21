/**
 * Throttler: controla que ciertos tipos de mensajes no se envíen
 * más frecuentemente de lo necesario.
 * 
 * Frecuencias definidas:
 * - session:       máximo 2/seg  (el juego ya lo manda a 2/seg)
 * - lap_data:      máximo 10/seg (reducimos de 60Hz a 10Hz)
 * - car_telemetry: máximo 10/seg
 * - car_status:    máximo 10/seg
 * - car_damage:    máximo 2/seg  (cambia lento)
 * - participants:  máximo 1/seg  (el juego lo manda cada 5 seg)
 * - event:         siempre       (son instantáneos, nunca throttle)
 * - lap_positions: máximo 1/seg
 */

const INTERVALS = {
  session:       500,
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

module.exports = new Throttler();
