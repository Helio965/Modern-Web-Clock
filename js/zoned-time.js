/**
 * Zoned time core.
 *
 * Single source of truth for every temporal value shown by the application.
 * The device clock (Date.now()) only supplies the current *instant*; the civil
 * date and wall-clock time are derived for an IANA time zone — the location
 * the user selected, America/Sao_Paulo by default — through
 * Intl.DateTimeFormat. Nothing in here reads the device's own time zone (no
 * getHours(), getDate(), getDay(), getTimezoneOffset(), ...), so the same
 * instant and zone always give the same result, whatever the device is
 * configured for.
 *
 * UTC offsets and daylight-saving rules are never stored or computed by hand:
 * they come from the environment's tz database through Intl. Every function
 * that depends on a zone takes it explicitly; there is no implicit fallback.
 *
 * Pure calendar helpers (leap years, month lengths, ISO weeks) operate on
 * civil dates through UTC arithmetic, which is time-zone neutral.
 */

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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
 * Time zones
 * ------------------------------------------------------------------------ */

/*
 * One formatter per IANA zone, created on first use and reused afterwards
 * (never one per frame). 'en-US' + 'latn' + 'gregory' guarantee plain ASCII
 * digits regardless of the user's locale; hourCycle 'h23' avoids the "24:00"
 * midnight quirk of hour12: false.
 */
const formatters = new Map();

function getFormatter(timeZone) {
  // Without a zone, Intl would silently use the device's own time zone.
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    throw new TypeError('A non-empty IANA time zone identifier is required.');
  }
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, // throws RangeError for zones this environment does not know
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
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `candidate` is an IANA time zone supported by this environment. */
export function isValidTimeZone(candidate) {
  try {
    getFormatter(candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * The environment's canonical spelling of a zone. Engines resolve aliases
 * differently (e.g. "Asia/Kolkata" may resolve to "Asia/Calcutta"), so zones
 * must be compared through this, never as plain strings.
 */
export function canonicalTimeZone(timeZone) {
  return getFormatter(timeZone).resolvedOptions().timeZone;
}

/** True when two identifiers name the same zone (aliases included). */
export function isSameTimeZone(a, b) {
  try {
    return canonicalTimeZone(a) === canonicalTimeZone(b);
  } catch {
    return false;
  }
}

/** Reads the wall clock (to the second) of `timeZone` for an instant. */
function readWallClock(epochMs, timeZone) {
  const fields = {};
  for (const { type, value } of getFormatter(timeZone).formatToParts(new Date(epochMs))) {
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

/** Offset from UTC, in milliseconds, of `timeZone` at an instant (e.g. +32 400 000 for UTC+09:00). */
export function getUtcOffsetMs(epochMs, timeZone) {
  const secondStart = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
  const wall = readWallClock(secondStart, timeZone);
  return civilToUtcMs(wall.year, wall.month, wall.day, wall.hours, wall.minutes, wall.seconds) - secondStart;
}

/**
 * Converts a civil date-time in `timeZone` into an epoch instant.
 *
 * Handles offset transitions the same way Temporal's "compatible" mode does:
 * an ambiguous time (clocks set back) resolves to the earlier instant and a
 * skipped time (clocks set forward) is pushed forward past the gap.
 *
 * @param {{ year: number, month: number, day: number, hours?: number,
 *           minutes?: number, seconds?: number, milliseconds?: number }} civil
 * @param {string} timeZone IANA identifier
 */
export function zonedTimeToEpoch(
  { year, month, day, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 },
  timeZone,
) {
  const wallAsUtc = civilToUtcMs(year, month, day, hours, minutes, seconds, milliseconds);
  const offsets = new Set([
    getUtcOffsetMs(wallAsUtc - MS_PER_DAY, timeZone),
    getUtcOffsetMs(wallAsUtc, timeZone),
    getUtcOffsetMs(wallAsUtc + MS_PER_DAY, timeZone),
  ]);
  const candidates = [...offsets].map((offset) => wallAsUtc - offset);
  const exact = candidates.filter((epoch) => epoch + getUtcOffsetMs(epoch, timeZone) === wallAsUtc);
  return exact.length > 0 ? Math.min(...exact) : Math.max(...candidates);
}

function buildSnapshotBase(secondStart, timeZone) {
  const { year, month, day, hours, minutes, seconds } = readWallClock(secondStart, timeZone);
  const weekdayIso = isoWeekday(year, month, day);
  const { week, weekYear } = isoWeek(year, month, day);
  const wallMs = civilToUtcMs(year, month, day, hours, minutes, seconds);

  return Object.freeze({
    timeZone,
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

/** ISO-8601 timestamp with the zone's offset, e.g. "2026-10-02T03:25:30+09:00". */
export function toZonedIsoString(dateTime) {
  const offset = dateTime.utcOffsetMinutes;
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${dateTime.dateKey}T${pad(dateTime.hours)}:${pad(dateTime.minutes)}:${pad(dateTime.seconds)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* ---------------------------------------------------------------------------
 * Temporal progress
 * ------------------------------------------------------------------------ */

/**
 * Start/end instants (epoch ms) of the day, ISO week (Monday to Sunday), month
 * and year containing `dateTime`, in the snapshot's own time zone. Boundaries
 * are real local midnights, so a 23 h or 25 h day (DST) is measured correctly.
 */
export function getPeriodBounds({ timeZone, year, month, day, isoWeekday: weekday }) {
  const startOf = (civil) => zonedTimeToEpoch(civil, timeZone);
  const today = { year, month, day };
  const monday = addDays(today, 1 - weekday);
  const nextMonth = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };

  return {
    day: { start: startOf(today), end: startOf(addDays(today, 1)) },
    week: { start: startOf(monday), end: startOf(addDays(monday, 7)) },
    month: { start: startOf({ year, month, day: 1 }), end: startOf(nextMonth) },
    year: { start: startOf({ year, month: 1, day: 1 }), end: startOf({ year: year + 1, month: 1, day: 1 }) },
  };
}

/* ---------------------------------------------------------------------------
 * Zoned time service
 * ------------------------------------------------------------------------ */

/**
 * Clock bound to one IANA zone, with its own caches: the Intl lookup runs at
 * most once per second and period boundaries once per date. Because every
 * zone has a separate service, switching zones can never reuse a snapshot or
 * boundaries computed for another zone.
 *
 * @param {string} timeZone IANA identifier (TypeError when missing, RangeError when unknown)
 */
export function createZonedTimeService(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    throw new TypeError('A non-empty IANA time zone identifier is required.');
  }
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unsupported time zone: ${timeZone}`);

  let cachedSecond = Number.NaN;
  let cachedBase = null;
  let cachedBounds = { dateKey: null, bounds: null };

  return Object.freeze({
    timeZone,

    /**
     * Date and time of `epochMs` in this zone.
     * @returns {{
     *   timeZone: string, epochMs: number,
     *   year: number, month: number, day: number,
     *   hours: number, minutes: number, seconds: number, milliseconds: number,
     *   isoWeekday: number, weekday: number, isoWeek: number, isoWeekYear: number,
     *   dayOfYear: number, daysInMonth: number, daysInYear: number, isLeapYear: boolean,
     *   utcOffsetMinutes: number, dateKey: string
     * }}
     * `weekday` follows the JavaScript convention (0 = Sunday); `isoWeekday`
     * is 1 = Monday ... 7 = Sunday.
     */
    getDateTime(epochMs = Date.now()) {
      if (!Number.isFinite(epochMs)) {
        throw new TypeError('getDateTime expects a finite epoch in milliseconds.');
      }
      const secondStart = Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;
      if (secondStart !== cachedSecond) {
        cachedBase = buildSnapshotBase(secondStart, timeZone);
        cachedSecond = secondStart;
      }
      return { ...cachedBase, epochMs, milliseconds: epochMs - secondStart };
    },

    /**
     * Fraction (0–1) of the current day, week, month and year already elapsed
     * in this zone, including the fraction of the current day and second.
     */
    getProgress(dateTime) {
      if (dateTime.timeZone !== timeZone) {
        throw new RangeError(`Snapshot is in ${dateTime.timeZone}, not ${timeZone}.`);
      }
      if (cachedBounds.dateKey !== dateTime.dateKey) {
        cachedBounds = { dateKey: dateTime.dateKey, bounds: getPeriodBounds(dateTime) };
      }
      const { bounds } = cachedBounds;
      const fraction = ({ start, end }) => Math.min(1, Math.max(0, (dateTime.epochMs - start) / (end - start)));
      return {
        day: fraction(bounds.day),
        week: fraction(bounds.week),
        month: fraction(bounds.month),
        year: fraction(bounds.year),
        bounds,
      };
    },

    /** Civil date-time in this zone → instant. */
    toEpoch(civil) {
      return zonedTimeToEpoch(civil, timeZone);
    },

    getUtcOffsetMs(epochMs) {
      return getUtcOffsetMs(epochMs, timeZone);
    },
  });
}

const MAX_SERVICES = 32;
const services = new Map();

/** Shared service for a zone (created on first use, kept in a small cache). */
export function getZonedTimeService(timeZone) {
  let service = services.get(timeZone);
  if (!service) {
    service = createZonedTimeService(timeZone);
    if (services.size >= MAX_SERVICES) services.delete(services.keys().next().value);
    services.set(timeZone, service);
  }
  return service;
}

/**
 * Date and time of an instant in an IANA zone — the function the UI reads.
 * @param {number} epochMs instant (e.g. Date.now())
 * @param {string} timeZone IANA identifier, e.g. "Asia/Tokyo"
 */
export function getZonedDateTime(epochMs, timeZone) {
  return getZonedTimeService(timeZone).getDateTime(epochMs);
}

/** Progress of the snapshot's day, week, month and year, in its own zone. */
export function getTemporalProgress(dateTime) {
  return getZonedTimeService(dateTime.timeZone).getProgress(dateTime);
}
