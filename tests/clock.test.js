import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getHandAngles } from '../js/clock.js';
import { getZonedDateTime } from '../js/zoned-time.js';
import {
  formatDuration,
  formatLongDate,
  formatPercent,
  formatShortDate,
  formatTime,
  formatTimeString,
  formatUtcOffset,
  ordinal,
  relativeDay,
} from '../js/i18n.js';

const SP = 'America/Sao_Paulo';
const at = (iso) => Date.parse(iso);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

describe('hand angles', () => {
  test('follow the continuous formulas', () => {
    const angles = getHandAngles({ hours: 13, minutes: 42, seconds: 18, milliseconds: 0 });
    close(angles.second, 18 * 6);
    close(angles.minute, 42 * 6 + 18 * 0.1);
    close(angles.hour, 1 * 30 + 42 * 0.5 + 18 / 120);
  });

  test('milliseconds give a smooth sweep; ticking mode ignores them', () => {
    const time = { hours: 0, minutes: 0, seconds: 30, milliseconds: 500 };
    close(getHandAngles(time).second, 183);
    close(getHandAngles(time, { smooth: false }).second, 180);
  });

  test('no jump across minute, hour and day changes', () => {
    const before = getZonedDateTime(at('2026-11-01T02:59:59.999Z'), SP); // 23:59:59.999 in São Paulo
    const after = getZonedDateTime(at('2026-11-01T03:00:00.000Z'), SP); // 00:00:00.000
    const a = getHandAngles(before);
    const b = getHandAngles(after);
    // Every hand is a hair before a full turn, then at 0°: continuous modulo 360°.
    for (const hand of ['hour', 'minute', 'second']) {
      assert.ok(360 - a[hand] < 0.01, `${hand} before midnight: ${a[hand]}`);
      close(b[hand], 0);
    }
  });

  test('angles come from São Paulo time, not the device', () => {
    const dt = getZonedDateTime(at('2026-10-01T18:00:00Z'), SP); // 15:00 in São Paulo
    close(getHandAngles(dt).hour, 90);
  });
});

describe('time formatting', () => {
  test('24-hour format', () => {
    assert.deepEqual(formatTime({ hours: 13, minutes: 42, seconds: 18 }), { hm: '13:42', seconds: '18', period: null });
    assert.equal(formatTimeString({ hours: 0, minutes: 5, seconds: 9 }), '00:05:09');
  });

  test('12-hour format with AM/PM', () => {
    const h12 = { hour12: true };
    assert.equal(formatTimeString({ hours: 0, minutes: 0, seconds: 0 }, h12), '12:00:00 AM');
    assert.equal(formatTimeString({ hours: 11, minutes: 59, seconds: 59 }, h12), '11:59:59 AM');
    assert.equal(formatTimeString({ hours: 12, minutes: 0, seconds: 0 }, h12), '12:00:00 PM');
    assert.equal(formatTimeString({ hours: 13, minutes: 42, seconds: 18 }, h12), '01:42:18 PM');
    assert.equal(formatTimeString({ hours: 23, minutes: 59, seconds: 59 }, { ...h12, showSeconds: false }), '11:59 PM');
  });

  test('dates in Portuguese and English', () => {
    const date = { year: 2026, month: 10, day: 1 };
    assert.equal(formatShortDate('pt', date), '01 OUT 2026');
    assert.equal(formatShortDate('en', date), '01 OCT 2026');
    assert.equal(formatLongDate('pt', date), '1 de outubro de 2026');
    assert.equal(formatLongDate('en', date), 'October 1, 2026');
  });

  test('ordinals, relative days, offsets, durations and percentages', () => {
    assert.equal(ordinal('pt', 274), '274º');
    assert.equal(ordinal('en', 274), '274th');
    assert.equal(ordinal('en', 1), '1st');
    assert.equal(ordinal('en', 112), '112th');
    assert.equal(ordinal('en', 123), '123rd');
    assert.equal(relativeDay('pt', 0), 'Hoje');
    assert.equal(relativeDay('pt', -3), 'Há 3 dias');
    assert.equal(relativeDay('en', 5), 'In 5 days');
    assert.equal(formatUtcOffset(-180), 'UTC−03:00');
    assert.equal(formatUtcOffset(-120), 'UTC−02:00');
    assert.equal(formatDuration(8 * 3_600_000 + 34 * 60_000 + 30_500), '08:34:30');
    assert.equal(formatPercent('pt', 0.5731), '57,31%');
    assert.equal(formatPercent('en', 0.29), '29.00%');
    assert.equal(formatPercent('en', 0.999999), '99.99%');
  });
});
