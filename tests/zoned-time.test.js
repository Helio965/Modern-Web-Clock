import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIME_ZONE,
  addDays,
  canonicalTimeZone,
  createZonedTimeService,
  dayOfYear,
  daysInMonth,
  daysInYear,
  getPeriodBounds,
  getTemporalProgress,
  getUtcOffsetMs,
  getZonedDateTime,
  getZonedTimeService,
  isLeapYear,
  isSameTimeZone,
  isValidTimeZone,
  isoWeek,
  isoWeekday,
  toZonedIsoString,
  zonedTimeToEpoch,
} from '../js/zoned-time.js';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../js/settings.js';

const SP = 'America/Sao_Paulo';
const sp = (ms) => getZonedDateTime(ms, SP);

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const at = (iso) => Date.parse(iso);
const pad = (n) => String(n).padStart(2, '0');
const wall = (dt) => `${dt.dateKey} ${pad(dt.hours)}:${pad(dt.minutes)}:${pad(dt.seconds)}`;

describe(`São Paulo, the default zone (device zone: ${deviceZone})`, () => {
  test('the default zone is America/Sao_Paulo and snapshots carry their zone', () => {
    assert.equal(DEFAULT_TIME_ZONE, 'America/Sao_Paulo');
    assert.equal(sp(0).timeZone, 'America/Sao_Paulo');
  });

  test('converts an instant to São Paulo wall-clock fields', () => {
    const dt = sp(at('2026-10-01T18:25:30.250Z'));
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
    const local = sp(instant);
    const device = new Date(instant);
    if (deviceZone === 'America/Sao_Paulo') {
      assert.equal(device.getHours(), local.hours);
    } else {
      // UTC → 18h, New York → 14h, London → 19h, Tokyo → 03h (already Oct 2nd).
      assert.notEqual(device.getHours(), local.hours);
    }
    assert.equal(local.hours, 15);
  });

  test('Tokyo already being on the next day does not move the São Paulo date', () => {
    const instant = at('2026-10-01T18:25:30Z'); // 03:25 on Oct 2nd in Tokyo
    const dt = sp(instant);
    assert.equal(dt.dateKey, '2026-10-01');
    assert.equal(dt.isoWeekday, 4);
  });

  test('milliseconds are preserved and negative epochs floor correctly', () => {
    assert.equal(sp(at('2026-10-01T18:25:30.999Z')).milliseconds, 999);
    const beforeEpoch = sp(-1);
    assert.equal(wall(beforeEpoch), '1969-12-31 20:59:59');
    assert.equal(beforeEpoch.milliseconds, 999);
  });

  test('calls within the same second share fields but return fresh objects', () => {
    const a = sp(at('2026-10-01T18:25:30.100Z'));
    const b = sp(at('2026-10-01T18:25:30.900Z'));
    assert.notEqual(a, b);
    assert.equal(wall(a), wall(b));
    assert.equal(b.milliseconds - a.milliseconds, 800);
  });

  test('rejects invalid instants', () => {
    assert.throws(() => sp(Number.NaN), TypeError);
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
      const seq = [-2000, -1000, 0, 1000].map((offset) => sp(midnight + offset));
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
    const lastDay = sp(at('2028-12-31T12:00:00Z'));
    assert.equal(lastDay.dayOfYear, 366);
    assert.equal(lastDay.daysInYear, 366);
    const firstDay = sp(at('2029-01-01T03:00:00Z'));
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
    assert.equal(zonedTimeToEpoch({ year: 2026, month: 10, day: 1, hours: 15, minutes: 25, seconds: 30 }, SP), at('2026-10-01T18:25:30Z'));
    assert.equal(zonedTimeToEpoch({ year: 2027, month: 1, day: 1 }, SP), at('2027-01-01T03:00:00Z'));
    assert.equal(getUtcOffsetMs(at('2026-10-01T18:25:30Z'), SP), -3 * 3_600_000);
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
      const dt = sp(instant);
      const back = zonedTimeToEpoch({ year: dt.year, month: dt.month, day: dt.day, hours: dt.hours, minutes: dt.minutes, seconds: dt.seconds, milliseconds: dt.milliseconds }, SP);
      assert.equal(wall(sp(back)), wall(dt));
    }
  });

  test('historical DST start (2018-11-04): midnight was skipped', () => {
    assert.equal(wall(sp(at('2018-11-04T02:59:59Z'))), '2018-11-03 23:59:59');
    const firstInstant = sp(at('2018-11-04T03:00:00Z'));
    assert.equal(wall(firstInstant), '2018-11-04 01:00:00');
    assert.equal(firstInstant.utcOffsetMinutes, -120);
    assert.equal(zonedTimeToEpoch({ year: 2018, month: 11, day: 4 }, SP), at('2018-11-04T03:00:00Z'));
  });

  test('historical DST end (2019-02-16): ambiguous hour resolves to the earlier instant', () => {
    assert.equal(zonedTimeToEpoch({ year: 2019, month: 2, day: 16, hours: 23, minutes: 30 }, SP), at('2019-02-17T01:30:00Z'));
    assert.equal(zonedTimeToEpoch({ year: 2019, month: 2, day: 17 }, SP), at('2019-02-17T03:00:00Z'));
  });
});

/* ---------------------------------------------------------------------------
 * Any IANA zone
 * ------------------------------------------------------------------------ */

const HOUR = 3_600_000;
const INSTANT = at('2026-10-01T18:25:30.250Z');

// The same instant in the zones the app must support (offsets on that date).
const SAME_INSTANT = [
  ['America/Sao_Paulo', '2026-10-01 15:25:30', -180, 4],
  ['America/New_York', '2026-10-01 14:25:30', -240, 4], // EDT
  ['America/Los_Angeles', '2026-10-01 11:25:30', -420, 4], // PDT
  ['Europe/London', '2026-10-01 19:25:30', 60, 4], // BST
  ['Europe/Paris', '2026-10-01 20:25:30', 120, 4], // CEST
  ['Asia/Tokyo', '2026-10-02 03:25:30', 540, 5],
  ['Asia/Kolkata', '2026-10-01 23:55:30', 330, 4],
  ['Australia/Sydney', '2026-10-02 04:25:30', 600, 5], // AEST (DST starts Oct 4th)
  ['Asia/Kathmandu', '2026-10-02 00:10:30', 345, 5],
];

describe(`any IANA zone (device zone: ${deviceZone})`, () => {
  test('one instant gives each zone its own civil date and time', () => {
    for (const [zone, expected, offset, weekday] of SAME_INSTANT) {
      const dt = getZonedDateTime(INSTANT, zone);
      assert.equal(dt.timeZone, zone);
      assert.equal(wall(dt), expected, zone);
      assert.equal(dt.utcOffsetMinutes, offset, zone);
      assert.equal(dt.isoWeekday, weekday, zone);
      assert.equal(dt.milliseconds, 250);
      assert.equal(dt.epochMs, INSTANT, 'the instant itself never changes');
      // The ISO string with offset points back to exactly the same instant.
      assert.equal(Date.parse(toZonedIsoString(dt)) + dt.milliseconds, INSTANT, zone);
    }
  });

  test('São Paulo is still on Thursday when Tokyo is already on Friday', () => {
    const saoPaulo = getZonedDateTime(INSTANT, 'America/Sao_Paulo');
    const tokyo = getZonedDateTime(INSTANT, 'Asia/Tokyo');
    assert.deepEqual([saoPaulo.dateKey, tokyo.dateKey], ['2026-10-01', '2026-10-02']);
    assert.deepEqual([saoPaulo.day, tokyo.day], [1, 2]); // day ring
    assert.deepEqual([saoPaulo.isoWeekday, tokyo.isoWeekday], [4, 5]); // weekday ring
    assert.deepEqual([saoPaulo.dayOfYear, tokyo.dayOfYear], [274, 275]);
    assert.deepEqual([saoPaulo.isoWeek, tokyo.isoWeek], [40, 40]);

    const spProgress = getTemporalProgress(saoPaulo);
    const tokyoProgress = getTemporalProgress(tokyo);
    assert.ok(Math.abs(spProgress.day - (15 * 3600 + 25 * 60 + 30.25) / 86_400) < 1e-9);
    assert.ok(Math.abs(tokyoProgress.day - (3 * 3600 + 25 * 60 + 30.25) / 86_400) < 1e-9);
    assert.ok(tokyoProgress.week > spProgress.week);
    assert.equal(spProgress.bounds.day.start, at('2026-10-01T03:00:00Z'));
    assert.equal(tokyoProgress.bounds.day.start, at('2026-10-01T15:00:00Z'));
  });

  test('switching the setting switches the snapshot immediately (same second, separate caches)', () => {
    let settings = sanitizeSettings({ ...DEFAULT_SETTINGS });
    const before = getZonedDateTime(INSTANT, settings.timeZone);
    settings = sanitizeSettings({ ...settings, timeZone: 'Asia/Tokyo', location: 'tokyo' });
    const after = getZonedDateTime(INSTANT + 10, settings.timeZone); // same second
    assert.equal(before.timeZone, 'America/Sao_Paulo');
    assert.equal(after.timeZone, 'Asia/Tokyo');
    assert.equal(wall(after), '2026-10-02 03:25:30');
    assert.equal(settings.theme, DEFAULT_SETTINGS.theme, 'other preferences unchanged');
    // Alternating zones within one second never leaks a cached snapshot.
    for (let i = 0; i < 4; i += 1) {
      assert.equal(getZonedDateTime(INSTANT, 'America/Sao_Paulo').hours, 15);
      assert.equal(getZonedDateTime(INSTANT, 'Asia/Tokyo').hours, 3);
    }
  });

  test('one service per zone; progress refuses a snapshot from another zone', () => {
    assert.equal(getZonedTimeService('Asia/Tokyo'), getZonedTimeService('Asia/Tokyo'));
    assert.notEqual(getZonedTimeService('Asia/Tokyo'), getZonedTimeService('America/Sao_Paulo'));
    const tokyoService = createZonedTimeService('Asia/Tokyo');
    assert.throws(() => tokyoService.getProgress(getZonedDateTime(INSTANT, 'America/Sao_Paulo')), RangeError);
    assert.equal(tokyoService.toEpoch({ year: 2026, month: 10, day: 2, hours: 3, minutes: 25, seconds: 30 }), at('2026-10-01T18:25:30Z'));
  });

  test('unsupported or missing zones are rejected — never replaced by the device zone', () => {
    for (const zone of ['Mars/Olympus', '', '  ', undefined, null, 42, 'UTC+3']) {
      assert.equal(isValidTimeZone(zone), false, String(zone));
    }
    assert.throws(() => getZonedDateTime(INSTANT, undefined), TypeError);
    assert.throws(() => getZonedDateTime(INSTANT, 'Mars/Olympus'), RangeError);
    assert.throws(() => createZonedTimeService(''), TypeError);
  });

  test('aliases are recognised as the same zone', () => {
    assert.equal(isSameTimeZone('Asia/Kolkata', 'Asia/Calcutta'), true);
    assert.equal(isSameTimeZone('Europe/Kyiv', 'Europe/Kiev'), true);
    assert.equal(isSameTimeZone('UTC', 'Etc/UTC'), true);
    assert.equal(isSameTimeZone('Asia/Tokyo', 'Asia/Seoul'), false);
    assert.equal(isSameTimeZone('Asia/Tokyo', 'Mars/Olympus'), false);
    assert.equal(canonicalTimeZone('Asia/Kolkata'), canonicalTimeZone('Asia/Calcutta'));
  });

  test('civil time ↔ instant round-trips in every zone', () => {
    const start = at('2000-01-01T00:00:00Z');
    const span = at('2040-01-01T00:00:00Z') - start;
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (const [zone] of SAME_INSTANT) {
      for (let i = 0; i < 300; i += 1) {
        const dt = getZonedDateTime(start + Math.floor(random() * span), zone);
        const back = zonedTimeToEpoch({ ...dt }, zone);
        assert.equal(wall(getZonedDateTime(back, zone)), wall(dt), zone);
      }
    }
  });
});

describe('daylight saving time by the real rules of each zone', () => {
  const dayLength = (zone, iso) => {
    const { day } = getPeriodBounds(getZonedDateTime(at(iso), zone));
    return (day.end - day.start) / HOUR;
  };

  test('New York springs forward on 2026-03-08 (02:00 does not exist)', () => {
    const zone = 'America/New_York';
    const before = getZonedDateTime(at('2026-03-08T06:59:59Z'), zone);
    const after = getZonedDateTime(at('2026-03-08T07:00:00Z'), zone);
    assert.equal(wall(before), '2026-03-08 01:59:59');
    assert.equal(before.utcOffsetMinutes, -300);
    assert.equal(wall(after), '2026-03-08 03:00:00');
    assert.equal(after.utcOffsetMinutes, -240);
    assert.equal(zonedTimeToEpoch({ year: 2026, month: 3, day: 8, hours: 2, minutes: 30 }, zone), at('2026-03-08T07:30:00Z'));
    assert.equal(dayLength(zone, '2026-03-08T16:00:00Z'), 23);
    assert.equal(dayLength(zone, '2026-03-09T16:00:00Z'), 24);
    // Noon EDT is 11 hours into a 23-hour day.
    const noon = getTemporalProgress(getZonedDateTime(at('2026-03-08T16:00:00Z'), zone));
    assert.ok(Math.abs(noon.day - 11 / 23) < 1e-9);
  });

  test('New York falls back on 2026-11-01 (01:30 happens twice)', () => {
    const zone = 'America/New_York';
    assert.equal(getZonedDateTime(at('2026-11-01T05:59:59Z'), zone).utcOffsetMinutes, -240);
    const after = getZonedDateTime(at('2026-11-01T06:00:00Z'), zone);
    assert.equal(wall(after), '2026-11-01 01:00:00');
    assert.equal(after.utcOffsetMinutes, -300);
    assert.equal(zonedTimeToEpoch({ year: 2026, month: 11, day: 1, hours: 1, minutes: 30 }, zone),
      at('2026-11-01T05:30:00Z'), 'ambiguous time resolves to the earlier instant');
    assert.equal(dayLength(zone, '2026-11-01T17:00:00Z'), 25);
    const noon = getTemporalProgress(getZonedDateTime(at('2026-11-01T17:00:00Z'), zone));
    assert.ok(Math.abs(noon.day - 13 / 25) < 1e-9);
  });

  test('London: GMT → BST on 2026-03-29 and back on 2026-10-25', () => {
    const zone = 'Europe/London';
    assert.equal(wall(getZonedDateTime(at('2026-03-29T00:59:59Z'), zone)), '2026-03-29 00:59:59');
    const bst = getZonedDateTime(at('2026-03-29T01:00:00Z'), zone);
    assert.equal(wall(bst), '2026-03-29 02:00:00');
    assert.equal(bst.utcOffsetMinutes, 60);
    assert.equal(getZonedDateTime(at('2026-10-25T01:00:00Z'), zone).utcOffsetMinutes, 0);
    assert.equal(dayLength(zone, '2026-03-29T12:00:00Z'), 23);
    assert.equal(dayLength(zone, '2026-10-25T12:00:00Z'), 25);
    assert.equal(dayLength(zone, '2026-07-01T12:00:00Z'), 24);
  });

  test('Sydney starts DST on 2026-10-04 (southern hemisphere)', () => {
    const zone = 'Australia/Sydney';
    assert.equal(getZonedDateTime(at('2026-10-03T15:59:59Z'), zone).utcOffsetMinutes, 600);
    const aedt = getZonedDateTime(at('2026-10-03T16:00:00Z'), zone);
    assert.equal(wall(aedt), '2026-10-04 03:00:00');
    assert.equal(aedt.utcOffsetMinutes, 660);
    assert.equal(dayLength(zone, '2026-10-04T02:00:00Z'), 23);
  });

  test('zones without DST keep 24-hour days and a constant offset', () => {
    for (const zone of ['America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Kolkata']) {
      for (const iso of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z']) {
        assert.equal(dayLength(zone, iso), 24, `${zone} ${iso}`);
      }
      assert.equal(getUtcOffsetMs(at('2026-01-15T12:00:00Z'), zone), getUtcOffsetMs(at('2026-07-15T12:00:00Z'), zone));
    }
  });
});
