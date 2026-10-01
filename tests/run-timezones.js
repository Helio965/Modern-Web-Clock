/**
 * Runs the whole test suite once per device time zone.
 *
 * Each run starts Node with a different TZ, which changes what Date's local
 * getters (getHours, getDate, ...) return, exactly like opening the site on a
 * computer configured for that region. The suite must pass unchanged in all
 * of them, proving the app's results only depend on America/Sao_Paulo.
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
