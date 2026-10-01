import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCATION,
  DEFAULT_SETTINGS,
  MAX_RECENTS,
  RECENTS_KEY,
  STORAGE_KEY,
  SettingsPanel,
  loadRecentLocations,
  loadSettings,
  rememberLocation,
  sanitizeSettings,
  saveSettings,
} from '../js/settings.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

/** SettingsPanel with the DOM stubbed out (the panel only needs a few calls). */
function createPanel(settings, storage) {
  const form = { addEventListener() {}, querySelector: () => null };
  const dialog = { querySelector: () => form, addEventListener() {} };
  const changes = [];
  const panel = new SettingsPanel({
    dialog,
    openButton: { addEventListener() {} },
    settings,
    storage,
    onChange: (next, key) => changes.push({ next, key }),
  });
  return { panel, changes };
}

describe('settings', () => {
  test('defaults: dark theme, 24h, Portuguese, seconds/progress visible, São Paulo', () => {
    assert.deepEqual(DEFAULT_SETTINGS, {
      theme: 'dark',
      hourFormat: '24',
      language: 'pt',
      showSeconds: true,
      showProgress: true,
      timeZone: 'America/Sao_Paulo',
      location: 'sao-paulo',
    });
    assert.deepEqual(DEFAULT_LOCATION, { timeZone: 'America/Sao_Paulo', location: 'sao-paulo' });
    assert.deepEqual(loadSettings(memoryStorage()), DEFAULT_SETTINGS);
  });

  test('invalid values fall back to defaults', () => {
    assert.deepEqual(sanitizeSettings({ theme: 'neon', hourFormat: 13, language: 'fr', showSeconds: 'yes' }), DEFAULT_SETTINGS);
    assert.deepEqual(loadSettings(memoryStorage({ [STORAGE_KEY]: '{not json' })), DEFAULT_SETTINGS);
  });

  test('round-trips through storage, including the time zone', () => {
    const storage = memoryStorage();
    const custom = {
      theme: 'light', hourFormat: '12', language: 'en', showSeconds: false, showProgress: false,
      timeZone: 'Asia/Tokyo', location: 'tokyo',
    };
    saveSettings(custom, storage);
    assert.deepEqual(loadSettings(storage), custom);
    assert.equal(JSON.parse(storage.dump()[STORAGE_KEY]).timeZone, 'Asia/Tokyo');
  });

  test('blocked storage does not throw', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
    assert.doesNotThrow(() => saveSettings(DEFAULT_SETTINGS, throwing));
  });
});

describe('time zone preference', () => {
  test('a supported IANA zone is kept', () => {
    for (const timeZone of ['Asia/Tokyo', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'UTC']) {
      assert.equal(sanitizeSettings({ timeZone }).timeZone, timeZone);
    }
  });

  test('an unsupported zone falls back to São Paulo and is reported', () => {
    for (const timeZone of ['Mars/Olympus', '', '   ', 42, null, 'UTC+3']) {
      const report = {};
      const settings = sanitizeSettings({ timeZone, theme: 'light' }, report);
      assert.equal(settings.timeZone, 'America/Sao_Paulo', String(timeZone));
      assert.equal(settings.location, 'sao-paulo');
      assert.equal(settings.theme, 'light', 'other preferences survive');
      assert.equal(report.rejectedTimeZone, String(timeZone));
    }
  });

  test('old settings without timeZone migrate to São Paulo and keep everything else', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ theme: 'light', hourFormat: '12' }) });
    assert.deepEqual(loadSettings(storage), { ...DEFAULT_SETTINGS, theme: 'light', hourFormat: '12' });
  });

  test('the location key is optional and must look like a catalogue key', () => {
    assert.equal(sanitizeSettings({ timeZone: 'Asia/Tokyo' }).location, null);
    assert.equal(sanitizeSettings({ timeZone: 'America/Sao_Paulo', location: 'brasilia' }).location, 'brasilia');
    assert.equal(sanitizeSettings({ timeZone: 'Asia/Tokyo', location: '<script>' }).location, null);
  });

  test('switching location saves it, notifies once and keeps the other preferences', () => {
    const storage = memoryStorage();
    const start = { ...DEFAULT_SETTINGS, theme: 'light', hourFormat: '12', language: 'en' };
    const { panel, changes } = createPanel(start, storage);

    panel.setLocation({ timeZone: 'Asia/Tokyo', location: 'tokyo' });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].key, 'timeZone');
    assert.deepEqual(changes[0].next, { ...start, timeZone: 'Asia/Tokyo', location: 'tokyo' });
    assert.deepEqual(loadSettings(storage), changes[0].next, 'reloading (F5) keeps Tokyo');

    panel.setLocation({ timeZone: 'Asia/Tokyo', location: 'tokyo' });
    assert.equal(changes.length, 1, 'choosing the current location again does nothing');

    panel.setLocation({ timeZone: 'Not/AZone' });
    assert.equal(changes.length, 1, 'unsupported zones are ignored');
    assert.equal(loadSettings(storage).timeZone, 'Asia/Tokyo');

    panel.setLocation(DEFAULT_LOCATION);
    assert.equal(loadSettings(storage).timeZone, 'America/Sao_Paulo', 'restoring the default');
    assert.equal(loadSettings(storage).theme, 'light');
  });
});

describe('recent locations', () => {
  test('newest first, de-duplicated, capped and validated', () => {
    const storage = memoryStorage();
    for (const timeZone of ['America/Sao_Paulo', 'Asia/Tokyo', 'America/New_York', 'Europe/London',
      'Europe/Paris', 'Australia/Sydney', 'Asia/Tokyo']) {
      rememberLocation({ timeZone, location: null }, storage);
    }
    const recents = loadRecentLocations(storage);
    assert.equal(recents.length, MAX_RECENTS);
    assert.deepEqual(recents.map((r) => r.timeZone),
      ['Asia/Tokyo', 'Australia/Sydney', 'Europe/Paris', 'Europe/London', 'America/New_York']);
  });

  test('aliases of the same zone and place are one entry', () => {
    const storage = memoryStorage();
    rememberLocation({ timeZone: 'Asia/Kolkata', location: 'new-delhi' }, storage);
    rememberLocation({ timeZone: 'Asia/Calcutta', location: 'new-delhi' }, storage);
    assert.deepEqual(loadRecentLocations(storage), [{ timeZone: 'Asia/Calcutta', location: 'new-delhi' }]);
  });

  test('ignores corrupt or unsupported entries', () => {
    const storage = memoryStorage({
      [RECENTS_KEY]: JSON.stringify([{ timeZone: 'Mars/Olympus' }, null, { timeZone: 'Asia/Tokyo', location: 'tokyo' }]),
    });
    assert.deepEqual(loadRecentLocations(storage), [{ timeZone: 'Asia/Tokyo', location: 'tokyo' }]);
    assert.deepEqual(loadRecentLocations(memoryStorage({ [RECENTS_KEY]: '{oops' })), []);
  });
});
