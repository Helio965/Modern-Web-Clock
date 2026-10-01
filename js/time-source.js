/**
 * Time source: where "now" comes from.
 *
 * In normal use this is simply the device clock (Date.now()), i.e. an
 * absolute instant that zoned-time.js converts to the selected time zone.
 *
 * For development and testing, a simulated clock can be started from any
 * São Paulo wall-clock moment through the URL, without waiting for that date
 * to arrive and without touching the device clock:
 *
 *   index.html?sim=2026-10-31T23:59:55          (runs at normal speed)
 *   index.html?sim=2026-12-31T23:59:50&speed=10  (runs 10x faster)
 *
 * The simulated value is always interpreted as São Paulo local time. The time
 * zone itself is never configurable.
 */

import { DEFAULT_TIME_ZONE, daysInMonth, zonedTimeToEpoch } from './zoned-time.js';

const SIM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const MAX_SPEED = 86_400;

/**
 * Parses `?sim=YYYY-MM-DDTHH:mm[:ss]` and the optional `&speed=N`.
 * Returns null when no (valid) simulation is requested.
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
    startEpochMs: zonedTimeToEpoch({ year, month, day, hours, minutes, seconds }, DEFAULT_TIME_ZONE),
    speed,
    label: raw.trim(),
  };
}

/**
 * Creates the clock the app reads every frame.
 *
 * @param {ReturnType<typeof parseSimulation>} simulation
 * @param {{ wallClock?: () => number, monotonic?: () => number }} [deps]
 *        Injectable clocks (used by the tests).
 */
export function createTimeSource(simulation = null, deps = {}) {
  const wallClock = deps.wallClock ?? (() => Date.now());
  const monotonic = deps.monotonic ?? (() => performance.now());

  if (!simulation) {
    return { simulated: false, speed: 1, label: null, now: wallClock };
  }

  const anchor = monotonic();
  return {
    simulated: true,
    speed: simulation.speed,
    label: simulation.label,
    now: () => simulation.startEpochMs + (monotonic() - anchor) * simulation.speed,
  };
}
