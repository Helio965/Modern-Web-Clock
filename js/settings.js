/**
 * User preferences: theme, hour format, language, seconds and progress
 * indicators. Saved in localStorage.
 *
 * There is deliberately no time-zone preference: the clock is always
 * America/Sao_Paulo. Unknown keys found in storage (e.g. a "timeZone" added by
 * hand) are discarded by sanitizeSettings().
 */

import { DEFAULT_LANGUAGE, LANGUAGES } from './i18n.js';

export const STORAGE_KEY = 'modern-circular-clock:settings';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  hourFormat: '24',
  language: DEFAULT_LANGUAGE,
  showSeconds: true,
  showProgress: true,
});

const ALLOWED_VALUES = {
  theme: ['dark', 'light'],
  hourFormat: ['24', '12'],
  language: LANGUAGES,
  showSeconds: [true, false],
  showProgress: [true, false],
};

/** Keeps only known keys with allowed values; everything else falls back to defaults. */
export function sanitizeSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const [key, allowed] of Object.entries(ALLOWED_VALUES)) {
      if (allowed.includes(raw[key])) settings[key] = raw[key];
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

export function loadSettings(storage = getStorage()) {
  try {
    return sanitizeSettings(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
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
   *           onChange: (settings: object, key: string) => void }} options
   */
  constructor({ dialog, openButton, settings, onChange }) {
    this.dialog = dialog;
    this.form = dialog.querySelector('form');
    this.settings = { ...settings };
    this.onChange = onChange;

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
    saveSettings(next);
    this.onChange({ ...next }, key);
  }

  syncForm() {
    for (const [key, value] of Object.entries(this.settings)) {
      const input = this.form.querySelector(`input[name="${key}"][value="${toFormValue(key, value)}"]`);
      if (input) input.checked = true;
    }
  }
}
