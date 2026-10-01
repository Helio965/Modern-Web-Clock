import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIME_ZONE,
  addDays,
  dayOfYear,
  daysInMonth,
  daysInYear,
  getSaoPauloDateTime,
  getUtcOffsetMs,
  isLeapYear,
  isoWeek,
  isoWeekday,
  toZonedIsoString,
  zonedTimeToEpoch,
} from '../js/sao-paulo-time.js';

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const at = (iso) => Date.parse(iso);
const pad = (n) => String(n).padStart(2, '0');
const wall = (dt) => `${dt.dateKey} ${pad(dt.hours)}:${pad(dt.minutes)}:${pad(dt.seconds)}`;

describe(`fixed reference zone (device zone: ${deviceZone})`, () => {
  test('the reference zone is America/Sao_Paulo', () => {
    assert.equal(TIME_ZONE, 'America/Sao_Paulo');
    assert.equal(getSaoPauloDateTime(0).timeZone, 'America/Sao_Paulo');
  });

  test('converts an instant to São Paulo wall-clock fields', () => {
    const dt = getSaoPauloDateTime(at('2026-10-01T18:25:30.250Z'));
    assert.equal(wall(dt), '2026-10-01 15:25:30');
    assert.equal(dt.milliseconds, 250);
    assert.equal(dt.isoWeekday, 4); // Thursday
    assert.equal(dt.weekday, 4);
    assert.equal(dt.utcOffsetMinutes, -180);
    assert.equal(dt.dayOfYear, 274);
    assert.equal(dt.daysInMonth, 31);
    assert.equal(dt.daysInYear, 365);
    assert.equal(dt.isLeapYear, false);
    assert.equal(dt.isoWeek, 40);
    assert.equal(toZonedIsoString(dt), '2026-10-01T15:25:30-03:00');
  });

  test('device-local getters disagree with São Paulo when the device is elsewhere', () => {
    const instant = at('2026-10-01T18:25:30Z');
    const sp = getSaoPauloDateTime(instant);
    const device = new Date(instant);
    if (deviceZone === 'America/Sao_Paulo') {
      assert.equal(device.getHours(), sp.hours);
    } else {
      // UTC → 18h, New York → 14h, London → 19h, Tokyo → 03h (already Oct 2nd).
      assert.notEqual(device.getHours(), sp.hours);
    }
    assert.equal(sp.hours, 15);
  });

  test('Tokyo already being on the next day does not move the São Paulo date', () => {
    const instant = at('2026-10-01T18:25:30Z'); // 03:25 on Oct 2nd in Tokyo
    const dt = getSaoPauloDateTime(instant);
    assert.equal(dt.dateKey, '2026-10-01');
    assert.equal(dt.isoWeekday, 4);
  });

  test('milliseconds are preserved and negative epochs floor correctly', () => {
    assert.equal(getSaoPauloDateTime(at('2026-10-01T18:25:30.999Z')).milliseconds, 999);
    const beforeEpoch = getSaoPauloDateTime(-1);
    assert.equal(wall(beforeEpoch), '1969-12-31 20:59:59');
    assert.equal(beforeEpoch.milliseconds, 999);
  });

  test('calls within the same second share fields but return fresh objects', () => {
    const a = getSaoPauloDateTime(at('2026-10-01T18:25:30.100Z'));
    const b = getSaoPauloDateTime(at('2026-10-01T18:25:30.900Z'));
    assert.notEqual(a, b);
    assert.equal(wall(a), wall(b));
    assert.equal(b.milliseconds - a.milliseconds, 800);
  });

  test('rejects invalid instants', () => {
    assert.throws(() => getSaoPauloDateTime(Number.NaN), TypeError);
  });
});

describe('day, month and year transitions (23:59:58 → 00:00:01)', () => {
  const transitions = [
    { name: '31/10 → 01/11', midnightUtc: '2026-11-01T03:00:00Z', before: '2026-10-31', after: '2026-11-01',
      beforeWeekday: 6, afterWeekday: 7, beforeMonthDays: 31, afterMonthDays: 30 },
    { name: '31/12 → 01/01 (new year)', midnightUtc: '2027-01-01T03:00:00Z', before: '2026-12-31', after: '2027-01-01',
      beforeWeekday: 4, afterWeekday: 5, beforeMonthDays: 31, afterMonthDays: 31 },
    { name: '28/02 → 01/03 (common year)', midnightUtc: '2026-03-01T03:00:00Z', before: '2026-02-28', after: '2026-03-01',
      beforeWeekday: 6, afterWeekday: 7, beforeMonthDays: 28, afterMonthDays: 31 },
    { name: '28/02 → 29/02 (leap year)', midnightUtc: '2028-02-29T03:00:00Z', before: '2028-02-28', after: '2028-02-29',
      beforeWeekday: 1, afterWeekday: 2, beforeMonthDays: 29, afterMonthDays: 29 },
    { name: '29/02 → 01/03 (leap year)', midnightUtc: '2028-03-01T03:00:00Z', before: '2028-02-29', after: '2028-03-01',
      beforeWeekday: 2, afterWeekday: 3, beforeMonthDays: 29, afterMonthDays: 31 },
    { name: '30/04 → 01/05 (30-day month)', midnightUtc: '2026-05-01T03:00:00Z', before: '2026-04-30', after: '2026-05-01',
      beforeWeekday: 4, afterWeekday: 5, beforeMonthDays: 30, afterMonthDays: 31 },
  ];

  for (const t of transitions) {
    test(t.name, () => {
      const midnight = at(t.midnightUtc);
      const seq = [-2000, -1000, 0, 1000].map((offset) => getSaoPauloDateTime(midnight + offset));
      assert.deepEqual(seq.map(wall), [
        `${t.before} 23:59:58`,
        `${t.before} 23:59:59`,
        `${t.after} 00:00:00`,
        `${t.after} 00:00:01`,
      ]);
      assert.equal(seq[1].isoWeekday, t.beforeWeekday);
      assert.equal(seq[2].isoWeekday, t.afterWeekday);
      assert.equal(seq[1].daysInMonth, t.beforeMonthDays);
      assert.equal(seq[2].daysInMonth, t.afterMonthDays);
    });
  }

  test('new year resets day of year and recomputes the year length', () => {
    const lastDay = getSaoPauloDateTime(at('2028-12-31T12:00:00Z'));
    assert.equal(lastDay.dayOfYear, 366);
    assert.equal(lastDay.daysInYear, 366);
    const firstDay = getSaoPauloDateTime(at('2029-01-01T03:00:00Z'));
    assert.equal(firstDay.year, 2029);
    assert.equal(firstDay.month, 1);
    assert.equal(firstDay.dayOfYear, 1);
    assert.equal(firstDay.daysInYear, 365);
  });
});

describe('calendar rules', () => {
  test('leap years follow the Gregorian rule', () => {
    for (const year of [2000, 2024, 2028, 2400]) assert.equal(isLeapYear(year), true, String(year));
    for (const year of [1900, 2026, 2027, 2100]) assert.equal(isLeapYear(year), false, String(year));
    assert.equal(daysInYear(2028), 366);
    assert.equal(daysInYear(2026), 365);
  });

  test('month lengths (28, 29, 30, 31)', () => {
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2028, 2), 29);
    assert.equal(daysInMonth(1900, 2), 28);
    assert.equal(daysInMonth(2000, 2), 29);
    assert.equal(daysInMonth(2026, 4), 30);
    assert.equal(daysInMonth(2026, 11), 30);
    assert.equal(daysInMonth(2026, 10), 31);
    assert.equal(daysInMonth(2026, 12), 31);
  });

  test('month lengths agree with the JavaScript calendar for 500 years', () => {
    for (let year = 1900; year < 2400; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const expected = new Date(Date.UTC(year, month, 0)).getUTCDate();
        assert.equal(daysInMonth(year, month), expected, `${year}-${month}`);
      }
    }
  });

  test('day of year, ISO weekday and ISO week', () => {
    assert.equal(dayOfYear(2026, 10, 1), 274);
    assert.equal(dayOfYear(2028, 12, 31), 366);
    assert.equal(isoWeekday(2026, 10, 1), 4);
    assert.equal(isoWeekday(2026, 11, 1), 7);
    assert.deepEqual(isoWeek(2026, 10, 1), { week: 40, weekYear: 2026 });
    assert.deepEqual(isoWeek(2027, 1, 1), { week: 53, weekYear: 2026 });
    assert.deepEqual(isoWeek(2024, 12, 30), { week: 1, weekYear: 2025 });
  });

  test('addDays rolls over months and years', () => {
    assert.deepEqual(addDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 });
    assert.deepEqual(addDays({ year: 2028, month: 3, day: 1 }, -1), { year: 2028, month: 2, day: 29 });
  });
});

describe('São Paulo wall time → instant', () => {
  test('known conversions', () => {
    assert.equal(zonedTimeToEpoch(2026, 10, 1, 15, 25, 30), at('2026-10-01T18:25:30Z'));
    assert.equal(zonedTimeToEpoch(2027, 1, 1), at('2027-01-01T03:00:00Z'));
    assert.equal(getUtcOffsetMs(at('2026-10-01T18:25:30Z')), -3 * 3_600_000);
  });

  test('round-trips random instants between 1990 and 2100', () => {
    const start = at('1990-01-01T00:00:00Z');
    const span = at('2100-01-01T00:00:00Z') - start;
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let i = 0; i < 1500; i += 1) {
      const instant = start + Math.floor(random() * span);
      const dt = getSaoPauloDateTime(instant);
      const back = zonedTimeToEpoch(dt.year, dt.month, dt.day, dt.hours, dt.minutes, dt.seconds, dt.milliseconds);
      assert.equal(wall(getSaoPauloDateTime(back)), wall(dt));
    }
  });

  test('historical DST start (2018-11-04): midnight was skipped', () => {
    assert.equal(wall(getSaoPauloDateTime(at('2018-11-04T02:59:59Z'))), '2018-11-03 23:59:59');
    const firstInstant = getSaoPauloDateTime(at('2018-11-04T03:00:00Z'));
    assert.equal(wall(firstInstant), '2018-11-04 01:00:00');
    assert.equal(firstInstant.utcOffsetMinutes, -120);
    assert.equal(zonedTimeToEpoch(2018, 11, 4), at('2018-11-04T03:00:00Z'));
  });

  test('historical DST end (2019-02-16): ambiguous hour resolves to the earlier instant', () => {
    assert.equal(zonedTimeToEpoch(2019, 2, 16, 23, 30), at('2019-02-17T01:30:00Z'));
    assert.equal(zonedTimeToEpoch(2019, 2, 17), at('2019-02-17T03:00:00Z'));
  });
});
