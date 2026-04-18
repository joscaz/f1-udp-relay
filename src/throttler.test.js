const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Throttler, INTERVALS } = require('./throttler');

const BASE_TIME = 10_000_000;

describe('Throttler', () => {
  let throttler;
  let now;
  const originalNow = Date.now;

  beforeEach(() => {
    throttler = new Throttler();
    now = BASE_TIME;
    Date.now = () => now;
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  it('lets unknown types pass through without limits', () => {
    assert.equal(throttler.shouldSend('event'), true);
    assert.equal(throttler.shouldSend('event'), true);
    assert.equal(throttler.shouldSend('event'), true);
  });

  it('blocks a second send for a throttled type inside the window', () => {
    assert.equal(throttler.shouldSend('lap_data'), true);
    now = BASE_TIME + INTERVALS.lap_data - 1;
    assert.equal(throttler.shouldSend('lap_data'), false);
  });

  it('allows a send once the minimum interval has elapsed', () => {
    assert.equal(throttler.shouldSend('lap_data'), true);
    now = BASE_TIME + INTERVALS.lap_data;
    assert.equal(throttler.shouldSend('lap_data'), true);
  });

  it('tracks each type independently', () => {
    assert.equal(throttler.shouldSend('session'), true);
    assert.equal(throttler.shouldSend('car_telemetry'), true);
    now = BASE_TIME + INTERVALS.car_telemetry - 1;
    assert.equal(throttler.shouldSend('session'), false);
    assert.equal(throttler.shouldSend('car_telemetry'), false);
  });

  it('reset() forgets the last-sent timestamps so the next send goes through', () => {
    assert.equal(throttler.shouldSend('lap_data'), true);
    now = BASE_TIME + 1;
    assert.equal(throttler.shouldSend('lap_data'), false);

    throttler.reset();
    assert.equal(throttler.shouldSend('lap_data'), true);
  });
});
