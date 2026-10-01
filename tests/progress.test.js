import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPeriodBounds, getTemporalProgress, getZonedDateTime } from '../js/zoned-time.js';

const SP = 'America/Sao_Paulo';

const at = (iso) => Date.parse(iso);
const progressAt = (iso, zone = SP) => getTemporalProgress(getZonedDateTime(at(iso), zone));
const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);

describe('temporal progress (São Paulo)', () => {
  test('day: midnight is 0%, noon is 50%, 23:59:59.999 is almost 100%', () => {
    close(progressAt('2026-10-01T03:00:00Z').day, 0);
    close(progressAt('2026-10-01T15:00:00Z').day, 0.5);
    const lastMs = progressAt('2026-10-02T02:59:59.999Z').day;
    assert.ok(lastMs < 1 && lastMs > 0.99999);
  });

  test('week runs Monday 00:00 → Sunday 24:00', () => {
    close(progressAt('2026-09-28T03:00:00Z').week, 0); // Monday 00:00
    close(progressAt('2026-10-01T15:00:00Z').week, 0.5); // Thursday 12:00 = 3.5 / 7
    assert.ok(progressAt('2026-10-05T02:59:59.999Z').week > 0.99999); // Sunday 23:59:59.999
    close(progressAt('2026-10-05T03:00:00Z').week, 0); // next Monday
  });

  test('month includes the fraction of the current day', () => {
    close(progressAt('2026-10-16T15:00:00Z').month, 15.5 / 31);
    close(progressAt('2026-02-15T03:00:00Z').month, 14 / 28);
    close(progressAt('2028-02-15T03:00:00Z').month, 14 / 29);
    close(progressAt('2026-04-16T03:00:00Z').month, 15 / 30);
  });

  test('year: middle of a common and of a leap year', () => {
    close(progressAt('2026-07-02T15:00:00Z').year, 0.5); // 182.5 / 365
    close(progressAt('2028-07-02T03:00:00Z').year, 0.5); // 183 / 366
    close(progressAt('2027-01-01T03:00:00Z').year, 0);
  });

  test('uses São Paulo midnight, not the device midnight', () => {
    // 01:00 UTC on Oct 2nd is still 22:00 on Oct 1st in São Paulo.
    const p = progressAt('2026-10-02T01:00:00Z');
    close(p.day, 22 / 24);
    assert.equal(p.bounds.day.start, at('2026-10-01T03:00:00Z'));
    assert.equal(p.bounds.day.end, at('2026-10-02T03:00:00Z'));
  });

  test('bounds follow the date when it changes', () => {
    const a = progressAt('2026-12-31T15:00:00Z');
    const b = progressAt('2027-01-01T15:00:00Z');
    assert.equal(a.bounds.year.end, b.bounds.year.start);
    close(b.year, 0.5 / 365);
  });

  test('a 23-hour DST day is measured on its real length', () => {
    const bounds = getPeriodBounds(getZonedDateTime(at('2018-11-04T15:00:00Z'), SP));
    assert.equal(bounds.day.end - bounds.day.start, 23 * 3_600_000);
    close(progressAt('2018-11-04T14:30:00Z').day, 0.5); // 12:30 local, 11.5 h of 23 h
  });
});
