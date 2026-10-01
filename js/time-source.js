/**
 * Time source: where "now" comes from.
 *
 * In normal use this is simply the device clock (Date.now()), i.e. an
 * absolute instant that zoned-time.js converts to the selected time zone.
 * Changing the location never changes the instant, only how it is shown.
 *
 * For development and testing, a simulated clock can be started from any
 * wall-clock moment through the URL, without waiting for that date to arrive
 * and without touching the device clock:
 *
 *   index.html?sim=2026-10-31T23:59:55          (runs at normal speed)
 *   index.html?sim=2026-12-31T23:59:50&speed=10  (runs 10x faster)
 *
 * The simulated value is a civil date-time in the *selected* time zone: with
 * Tokyo selected, ?sim=2026-12-31T23:59:50 means 23:59:50 on Dec 31st in
 * Tokyo. If the location changes while a simulation runs, the start is
 * re-interpreted in the new zone and the simulated time already elapsed is
 * kept — a simulation showing 23:59:55 in São Paulo shows 23:59:55 in Tokyo
 * after the switch, so the clock never jumps to an unrelated moment.
 */

import { daysInMonth, zonedTimeToEpoch } from './zoned-time.js';

const SIM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const MAX_SPEED = 86_400;

/**
 * Parses `?sim=YYYY-MM-DDTHH:mm[:ss]` and the optional `&speed=N`.
 * Returns the civil start time (no time zone yet) or null when no (valid)
 * simulation is requested.
 */
export function parseSimulation(search) {
  const params = new URLSearchParams(search);
  const raw = params.get('sim');
  if (!raw) return null;

  const match = SIM_PATTERN.exec(raw.trim());
  if (!match) return null;

  const [year, month, day, hours = 0, minutes = 0, seconds = 0] = match.slice(1).map((part) =>
    part === undefined ? undefined : Number(part));

  const valid =
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth(year, month) &&
    hours <= 23 && minutes <= 59 && seconds <= 59;
  if (!valid) return null;

  const requestedSpeed = Number(params.get('speed') ?? 1);
  const speed = Number.isFinite(requestedSpeed) && requestedSpeed > 0
    ? Math.min(requestedSpeed, MAX_SPEED)
    : 1;

  return {
    civil: Object.freeze({ year, month, day, hours, minutes, seconds }),
    speed,
    label: raw.trim(),
  };
}

/**
 * Creates the clock the app reads every frame.
 *
 * @param {ReturnType<typeof parseSimulation>} simulation
 * @param {{ timeZone?: string, wallClock?: () => number, monotonic?: () => number }} [options]
 *        timeZone: zone in which a simulated start is interpreted (the
 *        selected location; required for simulations); wallClock and
 *        monotonic are injectable for tests.
 */
export function createTimeSource(simulation = null, {
  timeZone,
  wallClock = () => Date.now(),
  monotonic = () => performance.now(),
} = {}) {
  if (!simulation) {
    return {
      simulated: false,
      speed: 1,
      label: null,
      now: wallClock,
      // The real clock is an absolute instant: nothing to re-interpret.
      setTimeZone() {},
    };
  }

  const anchor = monotonic();
  let startEpochMs = zonedTimeToEpoch(simulation.civil, timeZone);
  return {
    simulated: true,
    speed: simulation.speed,
    label: simulation.label,
    now: () => startEpochMs + (monotonic() - anchor) * simulation.speed,
    /** Re-interprets the simulated start in another zone, keeping the elapsed simulated time. */
    setTimeZone(nextTimeZone) {
      startEpochMs = zonedTimeToEpoch(simulation.civil, nextTimeZone);
    },
  };
}
