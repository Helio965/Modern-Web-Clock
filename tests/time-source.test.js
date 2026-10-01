import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createTimeSource, parseSimulation } from '../js/time-source.js';
import { getZonedDateTime } from '../js/zoned-time.js';

const at = (iso) => Date.parse(iso);
const pad = (n) => String(n).padStart(2, '0');
const wall = (dt) => `${dt.dateKey} ${pad(dt.hours)}:${pad(dt.minutes)}:${pad(dt.seconds)}`;

/** A simulated source whose monotonic clock the test advances by hand. */
function simulated(query, timeZone) {
  let monotonic = 1000;
  const source = createTimeSource(parseSimulation(query), { timeZone, monotonic: () => monotonic });
  return { source, advance: (ms) => { monotonic += ms; } };
}

describe('parseSimulation', () => {
  test('no parameter means the real clock', () => {
    assert.equal(parseSimulation(''), null);
    assert.equal(parseSimulation('?lang=en'), null);
  });

  test('returns a civil date-time, not yet tied to a zone', () => {
    assert.deepEqual(parseSimulation('?sim=2026-10-31T23:59:58'), {
      civil: { year: 2026, month: 10, day: 31, hours: 23, minutes: 59, seconds: 58 },
      speed: 1,
      label: '2026-10-31T23:59:58',
    });
    assert.deepEqual(parseSimulation('?sim=2028-02-29').civil,
      { year: 2028, month: 2, day: 29, hours: 0, minutes: 0, seconds: 0 });
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
  test('real mode returns the device instant whatever the zone', () => {
    const source = createTimeSource(null, { timeZone: 'Asia/Tokyo', wallClock: () => 1234 });
    assert.equal(source.simulated, false);
    assert.equal(source.now(), 1234);
    source.setTimeZone('America/New_York');
    assert.equal(source.now(), 1234, 'changing location never changes the real instant');
  });

  test('a simulation starts at that wall-clock time in the selected zone', () => {
    const query = '?sim=2026-10-31T23:59:58';
    assert.equal(simulated(query, 'America/Sao_Paulo').source.now(), at('2026-11-01T02:59:58Z'));
    assert.equal(simulated(query, 'Asia/Tokyo').source.now(), at('2026-10-31T14:59:58Z'));
    assert.equal(simulated(query, 'America/New_York').source.now(), at('2026-11-01T03:59:58Z'));
    for (const zone of ['America/Sao_Paulo', 'Asia/Tokyo', 'America/New_York', 'Europe/London']) {
      assert.equal(wall(getZonedDateTime(simulated(query, zone).source.now(), zone)), '2026-10-31 23:59:58', zone);
    }
  });

  test('advances at the given speed', () => {
    const { source, advance } = simulated('?sim=2026-12-31T23:59:50&speed=10', 'Asia/Tokyo');
    advance(1000);
    assert.equal(wall(getZonedDateTime(source.now(), 'Asia/Tokyo')), '2027-01-01 00:00:00');
  });

  test('changing location keeps the simulated civil time and elapsed time', () => {
    const { source, advance } = simulated('?sim=2026-12-31T23:59:55', 'America/Sao_Paulo');
    advance(3000);
    assert.equal(wall(getZonedDateTime(source.now(), 'America/Sao_Paulo')), '2026-12-31 23:59:58');
    source.setTimeZone('Asia/Tokyo');
    assert.equal(wall(getZonedDateTime(source.now(), 'Asia/Tokyo')), '2026-12-31 23:59:58');
    advance(2000);
    assert.equal(wall(getZonedDateTime(source.now(), 'Asia/Tokyo')), '2027-01-01 00:00:00');
  });

  test('a simulation crosses a DST transition by the real rules (New York, 2026-03-08)', () => {
    const { source, advance } = simulated('?sim=2026-03-08T01:59:58', 'America/New_York');
    advance(2000); // 02:00 does not exist: clocks jump to 03:00 EDT
    const dt = getZonedDateTime(source.now(), 'America/New_York');
    assert.equal(wall(dt), '2026-03-08 03:00:00');
    assert.equal(dt.utcOffsetMinutes, -240);
  });
});
