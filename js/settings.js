/**
 * User preferences: theme, hour format, language, seconds, progress
 * indicators and the location whose time the clock shows. Saved in
 * localStorage.
 *
 * The location is stored as an IANA time zone (`timeZone`, the reference for
 * every calculation) plus an optional catalogue key (`location`) that only
 * picks the display name among places sharing a zone (São Paulo, Rio de
 * Janeiro and Brasília are all America/Sao_Paulo). Stored zones are validated
 * against the environment; an unsupported one falls back to São Paulo.
 */

import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n.js';
import { DEFAULT_TIME_ZONE, isSameTimeZone, isValidTimeZone } from './zoned-time.js';

export const STORAGE_KEY = 'modern-circular-clock:settings';
export const RECENTS_KEY = 'modern-circular-clock:recent-locations';
export const MAX_RECENTS = 5;
export const DEFAULT_LOCATION_KEY = 'sao-paulo';
export const DEFAULT_LOCATION = Object.freeze({ timeZone: DEFAULT_TIME_ZONE, location: DEFAULT_LOCATION_KEY });

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  hourFormat: '24',
  language: DEFAULT_LANGUAGE,
  showSeconds: true,
  showProgress: true,
  timeZone: DEFAULT_TIME_ZONE,
  location: DEFAULT_LOCATION_KEY,
});

const ALLOWED_VALUES = {
  theme: ['dark', 'light'],
  hourFormat: ['24', '12'],
  language: LANGUAGES,
  showSeconds: [true, false],
  showProgress: [true, false],
};

const LOCATION_KEY_PATTERN = /^[a-z0-9-]{1,48}$/;

/**
 * Keeps only known keys with allowed values; everything else falls back to
 * defaults. Settings saved before time zones were configurable (no
 * `timeZone`) keep all their other values and get São Paulo.
 *
 * @param {object} raw parsed storage value
 * @param {{ rejectedTimeZone?: string }} [report] receives a stored zone that
 *        this environment does not support (so the UI can say so)
 */
export function sanitizeSettings(raw, report = null) {
  const settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return settings;

  for (const [key, allowed] of Object.entries(ALLOWED_VALUES)) {
    if (allowed.includes(raw[key])) settings[key] = raw[key];
  }

  if (raw.timeZone !== undefined) {
    if (isValidTimeZone(raw.timeZone)) {
      settings.timeZone = raw.timeZone;
      settings.location = typeof raw.location === 'string' && LOCATION_KEY_PATTERN.test(raw.location)
        ? raw.location
        : null;
    } else if (report) {
      report.rejectedTimeZone = String(raw.timeZone);
    }
  }
  return settings;
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // Storage can be blocked (privacy mode, sandboxed iframes).
  }
}

export function loadSettings(storage = getStorage(), report = null) {
  try {
    return sanitizeSettings(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'), report);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = getStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
  } catch {
    // Not persisting is acceptable; the current session keeps working.
  }
}

/* ---------- Recent locations ---------- */

// Aliases count as the same zone (e.g. Asia/Kolkata and Asia/Calcutta).
const sameLocation = (a, b) => a.location === b.location && isSameTimeZone(a.timeZone, b.timeZone);

/** Last chosen locations, newest first ({ timeZone, location } pairs). */
export function loadRecentLocations(storage = getStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(RECENTS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const recents = [];
    for (const entry of raw) {
      if (!entry || !isValidTimeZone(entry.timeZone)) continue;
      const item = {
        timeZone: entry.timeZone,
        location: typeof entry.location === 'string' && LOCATION_KEY_PATTERN.test(entry.location) ? entry.location : null,
      };
      if (!recents.some((other) => sameLocation(other, item))) recents.push(item);
      if (recents.length === MAX_RECENTS) break;
    }
    return recents;
  } catch {
    return [];
  }
}

/** Moves a location to the front of the recent list (max MAX_RECENTS). */
export function rememberLocation({ timeZone, location = null }, storage = getStorage()) {
  const item = { timeZone, location };
  const recents = [item, ...loadRecentLocations(storage).filter((other) => !sameLocation(other, item))]
    .slice(0, MAX_RECENTS);
  try {
    storage?.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // Not persisting is acceptable.
  }
  return recents;
}

/* Form radios carry strings; settings keep booleans for the show/hide pairs. */
const toFormValue = (key, value) => {
  if (key === 'showSeconds' || key === 'showProgress') return value ? 'show' : 'hide';
  return value;
};

const fromFormValue = (key, value) => {
  if (key === 'showSeconds' || key === 'showProgress') return value === 'show';
  return value;
};

/** Binds the settings <dialog> to a settings object. */
export class SettingsPanel {
  /**
   * @param {{ dialog: HTMLDialogElement, openButton: HTMLElement, settings: object,
   *           onChange: (settings: object, key: string) => void, storage?: Storage }} options
   */
  constructor({ dialog, openButton, settings, onChange, storage = getStorage() }) {
    this.dialog = dialog;
    this.form = dialog.querySelector('form');
    this.settings = { ...settings };
    this.onChange = onChange;
    this.storage = storage;

    openButton.addEventListener('click', () => this.open());
    // A click on the backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    this.form.addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !(input.name in ALLOWED_VALUES)) return;
      this.update(input.name, fromFormValue(input.name, input.value));
    });

    this.syncForm();
  }

  open() {
    this.syncForm();
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }

  update(key, value) {
    const next = sanitizeSettings({ ...this.settings, [key]: value });
    if (next[key] === this.settings[key]) return;
    this.settings = next;
    saveSettings(next, this.storage);
    this.onChange({ ...next }, key);
  }

  /**
   * Switches the clock to another location. Every other preference is kept.
   * @param {{ timeZone: string, location?: string | null }} choice
   */
  setLocation({ timeZone, location = null }) {
    const next = sanitizeSettings({ ...this.settings, timeZone, location });
    if (next.timeZone !== timeZone) return; // unsupported zone: ignore the request
    rememberLocation({ timeZone: next.timeZone, location: next.location }, this.storage);
    if (next.timeZone === this.settings.timeZone && next.location === this.settings.location) return;
    this.settings = next;
    saveSettings(next, this.storage);
    this.onChange({ ...next }, 'timeZone');
  }

  syncForm() {
    for (const [key, value] of Object.entries(this.settings)) {
      const input = this.form.querySelector(`input[name="${key}"][value="${toFormValue(key, value)}"]`);
      if (input) input.checked = true;
    }
  }
}
