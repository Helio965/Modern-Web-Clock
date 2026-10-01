import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  POPULAR_GROUPS,
  createLocationDirectory,
  detectDeviceTimeZone,
  formatLocation,
  locations,
  normalizeText,
} from '../js/locations.js';
import { isSameTimeZone, isValidTimeZone } from '../js/zoned-time.js';

const top = (query, language = 'pt') => {
  const [first] = locations.search(query, { language });
  return first ? { key: first.key, zone: first.zone, full: formatLocation(first, language).full } : null;
};

describe('location catalogue', () => {
  test('every curated zone is a real IANA zone supported here', () => {
    assert.ok(locations.catalogue.length >= 80);
    for (const location of locations.catalogue) {
      assert.ok(isValidTimeZone(location.zone), `${location.key}: ${location.zone}`);
    }
  });

  test('keys are unique and every place has names in both languages', () => {
    const keys = locations.catalogue.map((location) => location.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const location of locations.catalogue) {
      for (const names of [location.city, location.country].filter(Boolean)) {
        assert.ok(names.pt && names.en, location.key);
      }
    }
  });

  test('stores names and identifiers only — no offsets or DST rules', () => {
    for (const location of locations.catalogue) {
      for (const field of ['offset', 'utcOffset', 'dst', 'utcOffsetMinutes']) {
        assert.equal(field in location, false, `${location.key}.${field}`);
      }
    }
  });

  test('Brazilian locations map to their own zones (a country is not a time zone)', () => {
    const expected = {
      'sao-paulo': 'America/Sao_Paulo',
      manaus: 'America/Manaus',
      'rio-branco': 'America/Rio_Branco',
      cuiaba: 'America/Cuiaba',
      'fernando-de-noronha': 'America/Noronha',
    };
    for (const [key, zone] of Object.entries(expected)) assert.equal(locations.get(key).zone, zone);
  });

  test('labels in Portuguese and English', () => {
    assert.deepEqual(formatLocation(locations.get('tokyo'), 'pt'),
      { short: 'Tóquio', medium: 'Tóquio — Japão', full: 'Tóquio — Japão' });
    assert.deepEqual(formatLocation(locations.get('tokyo'), 'en'),
      { short: 'Tokyo', medium: 'Tokyo — Japan', full: 'Tokyo — Japan' });
    assert.equal(formatLocation(locations.get('manaus'), 'pt').full, 'Manaus — Amazonas — Brasil');
    assert.equal(formatLocation(locations.get('sao-paulo'), 'pt').full, 'São Paulo — Brasil');
    assert.equal(formatLocation(locations.get('singapore'), 'pt').full, 'Singapura');
  });

  test('popular groups for the empty search', () => {
    const groups = locations.popularGroups();
    assert.deepEqual(groups.map((group) => group.group), [...POPULAR_GROUPS]);
    assert.deepEqual(groups[0].locations.map((location) => location.key),
      ['sao-paulo', 'manaus', 'cuiaba', 'rio-branco', 'fernando-de-noronha']);
    const keys = groups.flatMap((group) => group.locations.map((location) => location.key));
    for (const key of ['new-york', 'los-angeles', 'toronto', 'mexico-city', 'london', 'paris', 'moscow',
      'tokyo', 'seoul', 'beijing', 'hong-kong', 'singapore', 'dubai', 'new-delhi', 'sydney', 'perth', 'auckland']) {
      assert.ok(keys.includes(key), key);
    }
  });
});

describe('location search', () => {
  test('finds a place by city, country, state or identifier, with or without accents', () => {
    assert.equal(top('tokyo').zone, 'Asia/Tokyo');
    assert.equal(top('Tóquio').zone, 'Asia/Tokyo');
    assert.equal(top('japão').zone, 'Asia/Tokyo');
    assert.equal(top('japao').zone, 'Asia/Tokyo');
    assert.equal(top('asia/tokyo').zone, 'Asia/Tokyo');
    assert.equal(top('manaus').full, 'Manaus — Amazonas — Brasil');
    assert.equal(top('amazonas').zone, 'America/Manaus');
    assert.equal(top('new york').full, 'Nova York — Estados Unidos');
    assert.equal(top('nova york').zone, 'America/New_York');
    assert.equal(top('sao paulo').key, 'sao-paulo');
    assert.equal(top('kolkata').zone, 'Asia/Kolkata');
    assert.equal(top('londres').zone, 'Europe/London');
    assert.equal(top('London', 'en').full, 'London — United Kingdom');
  });

  test('a country lists its places, popular first', () => {
    assert.deepEqual(locations.search('brasil').slice(0, 5).map((location) => location.key),
      ['sao-paulo', 'manaus', 'cuiaba', 'rio-branco', 'fernando-de-noronha']);
    assert.equal(locations.search('estados unidos')[0].key, 'new-york');
  });

  test('zones outside the catalogue are searchable with a derived name', () => {
    const [ushuaia] = locations.search('ushuaia');
    assert.equal(ushuaia.zone, 'America/Argentina/Ushuaia');
    assert.equal(formatLocation(ushuaia, 'pt').full, 'Ushuaia — Argentina — Américas');
  });

  test('aliases are not listed twice (Asia/Kolkata vs Asia/Calcutta)', () => {
    const india = locations.allLocations().filter((location) => isSameTimeZone(location.zone, 'Asia/Kolkata'));
    assert.ok(india.every((location) => !location.derived));
  });

  test('no match and blank queries', () => {
    assert.deepEqual(locations.search('xyzzy'), []);
    assert.deepEqual(locations.search('   '), []);
    assert.equal(normalizeText('  São-Paulo/Brasil  '), 'sao paulo brasil');
  });

  test('falls back to the curated catalogue without Intl.supportedValuesOf', () => {
    const missing = createLocationDirectory({ listZones: () => null });
    assert.equal(missing.allLocations().length, missing.catalogue.length);
    assert.equal(missing.search('tokyo')[0].key, 'tokyo');
    const throwing = createLocationDirectory({ listZones: () => { throw new TypeError('not supported'); } });
    assert.equal(throwing.search('manaus')[0].key, 'manaus');
  });
});

describe('resolving a stored preference', () => {
  test('uses the stored key only when it belongs to the zone', () => {
    assert.equal(locations.resolve('America/Sao_Paulo', 'brasilia').key, 'brasilia');
    assert.equal(locations.resolve('Asia/Tokyo', 'brasilia').key, 'tokyo');
    assert.equal(locations.resolve('America/Sao_Paulo').key, 'sao-paulo');
  });

  test('matches aliases and keeps the stored identifier', () => {
    const india = locations.resolve('Asia/Calcutta');
    assert.equal(india.key, 'new-delhi');
    assert.equal(india.zone, 'Asia/Calcutta');
  });

  test('derives a name for zones without a curated entry', () => {
    const resolved = locations.resolve('Pacific/Chatham');
    assert.equal(resolved.derived, true);
    assert.equal(formatLocation(resolved, 'en').full, 'Chatham — Pacific Ocean');
  });
});

describe('device time zone', () => {
  test('returns the detected zone when supported, null otherwise', () => {
    assert.equal(detectDeviceTimeZone(() => 'Asia/Tokyo'), 'Asia/Tokyo');
    assert.equal(detectDeviceTimeZone(() => 'Mars/Olympus'), null);
    assert.equal(detectDeviceTimeZone(() => undefined), null);
    assert.equal(detectDeviceTimeZone(() => { throw new Error('no Intl'); }), null);
    assert.equal(detectDeviceTimeZone(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
