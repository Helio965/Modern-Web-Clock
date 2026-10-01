import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, sanitizeSettings, saveSettings } from '../js/settings.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

describe('settings', () => {
  test('defaults: dark theme, 24h, Portuguese, seconds and progress visible', () => {
    assert.deepEqual(DEFAULT_SETTINGS, {
      theme: 'dark', hourFormat: '24', language: 'pt', showSeconds: true, showProgress: true,
    });
    assert.deepEqual(loadSettings(memoryStorage()), DEFAULT_SETTINGS);
  });

  test('there is no time-zone setting, even if one is injected in storage', () => {
    assert.equal('timeZone' in DEFAULT_SETTINGS, false);
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ timeZone: 'Asia/Tokyo', theme: 'light' }) });
    const settings = loadSettings(storage);
    assert.equal('timeZone' in settings, false);
    assert.equal(settings.theme, 'light');
  });

  test('invalid values fall back to defaults', () => {
    assert.deepEqual(sanitizeSettings({ theme: 'neon', hourFormat: 13, language: 'fr', showSeconds: 'yes' }), DEFAULT_SETTINGS);
    assert.deepEqual(loadSettings(memoryStorage({ [STORAGE_KEY]: '{not json' })), DEFAULT_SETTINGS);
  });

  test('round-trips through storage', () => {
    const storage = memoryStorage();
    const custom = { theme: 'light', hourFormat: '12', language: 'en', showSeconds: false, showProgress: false };
    saveSettings(custom, storage);
    assert.deepEqual(loadSettings(storage), custom);
  });

  test('blocked storage does not throw', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
    assert.doesNotThrow(() => saveSettings(DEFAULT_SETTINGS, throwing));
  });
});
