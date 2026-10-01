/**
 * São Paulo time core.
 *
 * This module is the single source of truth for every temporal value shown
 * by the application. The device clock (Date.now()) is used only as the
 * source of the current *instant*; the civil date and wall-clock time are
 * always derived for the fixed IANA zone "America/Sao_Paulo" through
 * Intl.DateTimeFormat. Nothing in here reads the device's own time zone
 * (no getHours(), getDate(), getDay(), getTimezoneOffset(), ...), so the
 * result is the same whether the browser runs in Brazil, Japan or on a
 * UTC server.
 *
 * Pure calendar helpers (leap years, month lengths, ISO weeks) operate on
 * civil dates through UTC arithmetic, which is time-zone neutral.
 */

export const TIME_ZONE = 'America/Sao_Paulo';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/*
 * One formatter, created once, pinned to São Paulo. 'en-US' + 'latn' +
 * 'gregory' guarantee plain ASCII digits regardless of the user's locale;
 * hourCycle 'h23' avoids the "24:00" midnight quirk of hour12: false.
 */
const wallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

if (wallClockFormatter.resolvedOptions().timeZone !== TIME_ZONE) {
  throw new RangeError(`This environment cannot resolve the ${TIME_ZONE} time zone.`);
}

/* ---------------------------------------------------------------------------
 * Pure civil-calendar helpers (time-zone neutral)
 * ------------------------------------------------------------------------ */

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

/** Number of days in a month (month is 1-12). February follows the leap-year rule. */
export function daysInMonth(year, month) {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1];
}

/** Epoch milliseconds of a civil date-time interpreted as UTC (works for any year). */
export function civilToUtcMs(year, month, day, hours = 0, minutes = 0, seconds = 0, ms = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hours, minutes, seconds, ms);
  return date.getTime();
}

function utcMsToCivil(epochMs) {
  const date = new Date(epochMs);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Adds (or subtracts) whole days to a civil date, handling month/year rollover. */
export function addDays({ year, month, day }, amount) {
  return utcMsToCivil(civilToUtcMs(year, month, day) + amount * MS_PER_DAY);
}

/** 1 for January 1st ... 365/366 for December 31st. */
export function dayOfYear(year, month, day) {
  return Math.round((civilToUtcMs(year, month, day) - civilToUtcMs(year, 1, 1)) / MS_PER_DAY) + 1;
}

/** ISO weekday of a civil date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(year, month, day) {
  const sundayBased = new Date(civilToUtcMs(year, month, day)).getUTCDay();
  return sundayBased === 0 ? 7 : sundayBased;
}

/** ISO-8601 week number and week-numbering year of a civil date. */
export function isoWeek(year, month, day) {
  const thursday = addDays({ year, month, day }, 4 - isoWeekday(year, month, day));
  return {
    week: Math.floor((dayOfYear(thursday.year, thursday.month, thursday.day) - 1) / 7) + 1,
    weekYear: thursday.year,
  };
}

export function compareCivil(a, b) {
  return civilToUtcMs(a.year, a.month, a.day) - civilToUtcMs(b.year, b.month, b.day);
}

/** Whole days from civil date `from` to civil date `to` (negative when `to` is earlier). */
export function daysBetween(from, to) {
  return Math.round(compareCivil(to, from) / MS_PER_DAY);
}

const pad = (value, length = 2) => String(value).padStart(length, '0');

export function toDateKey({ year, month, day }) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/* ---------------------------------------------------------------------------
 * São Paulo wall clock
 * ------------------------------------------------------------------------ */

/** Reads the São Paulo wall clock (to the second) for an instant. */
function readWallClock(epochMs) {
  const fields = {};
  for (const { type, value } of wallClockFormatter.formatToParts(new Date(epochMs))) {
    if (type !== 'literal') fields[type] = Number(value);
  }
  return {
    year: fields.year,
    month: fields.month,
    day: fields.day,
    hours: fields.hour % 24,
    minutes: fields.minute,
    seconds: fields.second,
  };
}

/** São Paulo's offset from UTC, in milliseconds, at a given instant (e.g. -10 800 000 for UTC−03:00). */
export function getUtcOffsetMs(epochMs) {
  const secondStart = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
  const wall = readWallClock(secondStart);
  return civilToUtcMs(wall.year, wall.month, wall.day, wall.hours, wall.minutes, wall.seconds) - secondStart;
}

/**
 * Converts a São Paulo wall-clock date-time into an epoch instant.
 *
 * Handles offset transitions the same way Temporal's "compatible" mode does:
 * an ambiguous time (clocks set back) resolves to the earlier instant and a
 * skipped time (clocks set forward) is pushed forward past the gap. Brazil has
 * not observed DST since 2019, but historical dates and any future tz-database
 * change are still handled correctly.
 */
export function zonedTimeToEpoch(year, month, day, hours = 0, minutes = 0, seconds = 0, ms = 0) {
  const wallAsUtc = civilToUtcMs(year, month, day, hours, minutes, seconds, ms);
  const offsets = new Set([
    getUtcOffsetMs(wallAsUtc - MS_PER_DAY),
    getUtcOffsetMs(wallAsUtc),
    getUtcOffsetMs(wallAsUtc + MS_PER_DAY),
  ]);
  const candidates = [...offsets].map((offset) => wallAsUtc - offset);
  const exact = candidates.filter((epoch) => epoch + getUtcOffsetMs(epoch) === wallAsUtc);
  return exact.length > 0 ? Math.min(...exact) : Math.max(...candidates);
}

let cachedSecond = Number.NaN;
let cachedBase = null;

function buildSnapshotBase(secondStart) {
  const { year, month, day, hours, minutes, seconds } = readWallClock(secondStart);
  const weekdayIso = isoWeekday(year, month, day);
  const { week, weekYear } = isoWeek(year, month, day);
  const wallMs = civilToUtcMs(year, month, day, hours, minutes, seconds);

  return Object.freeze({
    timeZone: TIME_ZONE,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    isoWeekday: weekdayIso,
    weekday: weekdayIso % 7,
    isoWeek: week,
    isoWeekYear: weekYear,
    dayOfYear: dayOfYear(year, month, day),
    daysInMonth: daysInMonth(year, month),
    daysInYear: daysInYear(year),
    isLeapYear: isLeapYear(year),
    utcOffsetMinutes: Math.round((wallMs - secondStart) / MS_PER_MINUTE),
    dateKey: toDateKey({ year, month, day }),
  });
}

/**
 * Current date and time in São Paulo — the one function the whole UI reads.
 *
 * @param {number} [epochMs=Date.now()] Instant to convert (defaults to now).
 * @returns {{
 *   timeZone: string, epochMs: number,
 *   year: number, month: number, day: number,
 *   hours: number, minutes: number, seconds: number, milliseconds: number,
 *   isoWeekday: number, weekday: number, isoWeek: number, isoWeekYear: number,
 *   dayOfYear: number, daysInMonth: number, daysInYear: number, isLeapYear: boolean,
 *   utcOffsetMinutes: number, dateKey: string
 * }}
 *
 * `weekday` follows the JavaScript convention (0 = Sunday); `isoWeekday` is
 * 1 = Monday ... 7 = Sunday. The Intl lookup runs at most once per second;
 * calls within the same second only refresh the milliseconds.
 */
export function getSaoPauloDateTime(epochMs = Date.now()) {
  if (!Number.isFinite(epochMs)) {
    throw new TypeError('getSaoPauloDateTime expects a finite epoch in milliseconds.');
  }
  const secondStart = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
  if (secondStart !== cachedSecond) {
    cachedBase = buildSnapshotBase(secondStart);
    cachedSecond = secondStart;
  }
  return { ...cachedBase, epochMs, milliseconds: epochMs - secondStart };
}

/** ISO-8601 timestamp with São Paulo's offset, e.g. "2026-10-01T15:25:30-03:00". */
export function toZonedIsoString(dateTime) {
  const offset = dateTime.utcOffsetMinutes;
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${dateTime.dateKey}T${pad(dateTime.hours)}:${pad(dateTime.minutes)}:${pad(dateTime.seconds)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
