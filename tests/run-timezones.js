/**
 * Runs the whole test suite once per *device* time zone.
 *
 * Two different things are called "time zone" in this project:
 *   - the device time zone: how the computer running the code is configured
 *     (here: the TZ environment variable of each Node run);
 *   - the selected time zone: the location chosen in the app (the IANA zone
 *     passed explicitly to zoned-time.js, e.g. "Asia/Tokyo").
 *
 * Each run changes what Date's local getters (getHours, getDate, ...) return,
 * exactly like opening the site on a computer configured for that region. The
 * suite — which asserts fixed results for São Paulo, Tokyo, New York, London,
 * Sydney... — must pass unchanged in all of them, proving that the clock only
 * depends on the selected zone, never on the device's.
 *
 * Usage: npm run test:tz
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DEVICE_ZONES = [
  'America/Sao_Paulo',
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Asia/Kolkata', // UTC+05:30
  'Pacific/Kiritimati', // UTC+14
  'Pacific/Pago_Pago', // UTC−11
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

for (const zone of DEVICE_ZONES) {
  console.log(`\n▶ Device time zone: ${zone}`);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=dot', 'tests/**/*.test.js'], {
    cwd: root,
    env: { ...process.env, TZ: zone },
    stdio: 'inherit',
  });
  if (result.status !== 0) failures.push(zone);
}

console.log('');
if (failures.length > 0) {
  console.error(`✖ Failed with device time zone(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`✔ All tests passed in ${DEVICE_ZONES.length} device time zones.`);
