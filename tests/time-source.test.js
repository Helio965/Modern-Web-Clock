import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createTimeSource, parseSimulation } from '../js/time-source.js';

const at = (iso) => Date.parse(iso);

describe('parseSimulation', () => {
  test('no parameter means the real clock', () => {
    assert.equal(parseSimulation(''), null);
    assert.equal(parseSimulation('?lang=en'), null);
  });

  test('interprets the value as São Paulo wall-clock time', () => {
    const sim = parseSimulation('?sim=2026-10-31T23:59:58');
    assert.equal(sim.startEpochMs, at('2026-11-01T02:59:58Z'));
    assert.equal(sim.speed, 1);
  });

  test('accepts a date without time (midnight in São Paulo)', () => {
    assert.equal(parseSimulation('?sim=2028-02-29').startEpochMs, at('2028-02-29T03:00:00Z'));
  });

  test('speed is optional, positive and capped', () => {
    assert.equal(parseSimulation('?sim=2026-12-31T23:59:50&speed=60').speed, 60);
    assert.equal(parseSimulation('?sim=2026-12-31T23:59:50&speed=-3').speed, 1);
    assert.equal(parseSimulation('?sim=2026-12-31T23:59:50&speed=abc').speed, 1);
    assert.equal(parseSimulation('?sim=2026-12-31T23:59:50&speed=999999').speed, 86_400);
  });

  test('rejects impossible or malformed dates', () => {
    for (const value of ['2026-02-29', '2026-13-01', '2026-04-31T10:00', '2026-10-01T24:00', 'hello']) {
      assert.equal(parseSimulation(`?sim=${value}`), null, value);
    }
  });
});

describe('createTimeSource', () => {
  test('real mode returns the device instant', () => {
    const source = createTimeSource(null, { wallClock: () => 1234 });
    assert.equal(source.simulated, false);
    assert.equal(source.now(), 1234);
  });

  test('simulated mode advances from the start instant at the given speed', () => {
    let monotonic = 500;
    const source = createTimeSource(
      { startEpochMs: at('2026-12-31T23:59:50Z'), speed: 10, label: 'x' },
      { monotonic: () => monotonic },
    );
    assert.equal(source.simulated, true);
    assert.equal(source.now(), at('2026-12-31T23:59:50Z'));
    monotonic += 1000;
    assert.equal(source.now(), at('2027-01-01T00:00:00Z'));
  });
});
