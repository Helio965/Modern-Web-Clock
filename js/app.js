/**
 * Application bootstrap and render loop.
 *
 * The selected location's IANA time zone (settings.timeZone, São Paulo by
 * default) is the single temporal reference: a single requestAnimationFrame
 * loop reads one snapshot per frame from zoned-time.js for that zone and hands
 * it to the UI modules. Work is split by how often it really changes:
 *   - every frame:  analog hands (smooth motion)
 *   - every second: digital time, UTC offset, progress, tab title
 *   - every date:   calendar rings and the date readout
 * Settings changes re-render only what they affect; a location change resets
 * the cached render state so everything is redrawn for the new zone at once.
 */

import { getTemporalProgress, getZonedDateTime } from './zoned-time.js';
import { createTimeSource, parseSimulation } from './time-source.js';
import { CalendarRings } from './calendar.js';
import { AnalogClock, DigitalClock } from './clock.js';
import { ProgressPanel } from './progress.js';
import { SettingsPanel, loadRecentLocations, loadSettings } from './settings.js';
import { formatLocation, locations } from './locations.js';
import { LocationPicker } from './location-picker.js';
import { applyTranslations, formatTimeString, formatUtcOffset, getDictionary, t } from './i18n.js';
import {
  TooltipController,
  describeDay,
  describeFace,
  describeMonth,
  describeMonthLength,
  describeProgress,
  describeWeek,
  describeWeekday,
  describeYear,
} from './tooltip.js';

const HANDS_INTRO_DELAY_MS = 550;
const HANDS_INTRO_MS = 900;
const INTRO_TOTAL_MS = 1700;
const NOTICE_MS = 9000;
const THEME_COLORS = { dark: '#0a0b0d', light: '#e7eaee' };

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const storageReport = {};
let settings = loadSettings(undefined, storageReport);
let place = locations.resolve(settings.timeZone, settings.location);

const timeSource = createTimeSource(parseSimulation(window.location.search));
const calendar = new CalendarRings(document.getElementById('clock-rings'));
const analog = new AnalogClock(
  document.getElementById('clock-face-details'),
  document.getElementById('clock-hands'),
);
const digital = new DigitalClock(document.getElementById('digital'));
const progressPanel = new ProgressPanel(document.getElementById('progress'));
const simBadge = document.getElementById('sim-badge');
const notice = document.getElementById('notice');
const locationChip = document.getElementById('location-chip');
const locationCard = document.getElementById('location-card');
const tooltips = new TooltipController({
  element: document.getElementById('tooltip'),
  liveRegion: document.getElementById('live-region'),
  getContent: tooltipContent,
});

let lastDateKey = null;
let lastSecond = null;
let lastOffset = null;
let lastTitle = '';
let introStart = 0;
let introRunning = false;

const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const readNow = () => getZonedDateTime(timeSource.now(), settings.timeZone);
const timeOptions = () => ({ hour12: settings.hourFormat === '12', showSeconds: settings.showSeconds });
const placeNames = () => formatLocation(place, settings.language);

/* ---------- Rendering ---------- */

/** Every place where the location's name or zone is shown. */
function renderLocation() {
  const names = placeNames();
  const { locale } = getDictionary(settings.language);
  root.dataset.timeZone = settings.timeZone;
  for (const node of document.querySelectorAll('[data-location]')) {
    const value = {
      short: names.short,
      medium: names.medium,
      full: names.full,
      zone: settings.timeZone,
      'time-in': t(settings.language, 'timeIn', names.short),
    }[node.dataset.location];
    if (value !== undefined && node.textContent !== value) node.textContent = value;
  }
  document.getElementById('clock-dial').setAttribute('aria-label', t(settings.language, 'clockLabel', names.short));
  for (const opener of [locationChip, locationCard]) {
    opener.setAttribute('aria-label', t(settings.language, 'changeLocation', names.full));
  }
  analog.setCity(names.short.toLocaleUpperCase(locale));
}

function renderDate(now, animate = lastDateKey !== null) {
  calendar.update(now, { animate });
  digital.renderDate(now, settings.language);
  lastDateKey = now.dateKey;
}

/** UTC offset: checked every second, since DST changes it in the middle of a day. */
function renderOffset(now) {
  if (now.utcOffsetMinutes === lastOffset) return;
  analog.setOffset(now.utcOffsetMinutes);
  digital.renderOffset(now.utcOffsetMinutes);
  for (const node of document.querySelectorAll('[data-utc-offset]')) {
    node.textContent = formatUtcOffset(now.utcOffsetMinutes);
  }
  lastOffset = now.utcOffsetMinutes;
}

function renderProgress(now, growth = 1) {
  if (!settings.showProgress) return;
  progressPanel.render(now, getTemporalProgress(now), settings.language, growth);
}

function renderTitle(now) {
  const time = formatTimeString(now, { ...timeOptions(), showSeconds: false });
  const title = `${time} · ${placeNames().short} — Modern Circular Clock`;
  if (title !== lastTitle) {
    document.title = title;
    lastTitle = title;
  }
}

function renderSecond(now, growth = 1) {
  digital.renderTime(now, timeOptions());
  renderOffset(now);
  renderProgress(now, growth);
  renderTitle(now);
  tooltips.refresh();
  lastSecond = now.epochMs - now.milliseconds;
}

/** Tooltip text for whatever element is hovered, tapped or explored. */
function tooltipContent(target) {
  const now = readNow();
  const { language } = settings;
  const names = placeNames();
  const { ring } = target.dataset;
  switch (target.dataset.tip) {
    case 'ring-item': {
      const value = Number(target.dataset.index) + 1;
      if (ring === 'days') return describeDay(now, value, language, names.full);
      if (ring === 'months') return describeMonth(now, value, language);
      return describeWeekday(now, value, language);
    }
    case 'ring-gap':
      if (ring === 'days') return describeMonthLength(now, language);
      if (ring === 'months') return describeYear(now, language);
      return describeWeek(now, language);
    case 'progress':
      return describeProgress(target.dataset.progressRow, now, getTemporalProgress(now), language, names.full);
    case 'face':
      return describeFace(now, language, { ...timeOptions(), placeName: names.short });
    default:
      return null;
  }
}

function introProgress(timestamp) {
  if (!introRunning) return 1;
  return Math.min(1, Math.max(0, (timestamp - introStart - HANDS_INTRO_DELAY_MS) / HANDS_INTRO_MS));
}

function frame(timestamp) {
  const now = readNow();
  const intro = introProgress(timestamp);
  const growth = intro < 1 ? easeOutCubic(intro) : 1;

  if (now.dateKey !== lastDateKey) renderDate(now);
  if (now.epochMs - now.milliseconds !== lastSecond) renderSecond(now, growth);
  else if (growth < 1) renderProgress(now, growth);
  analog.render(now, { smooth: !reducedMotion.matches, intro });

  window.requestAnimationFrame(frame);
}

/* ---------- Settings ---------- */

function renderSimulationBadge() {
  if (!timeSource.simulated) return;
  const speed = timeSource.speed === 1 ? '' : ` · ${timeSource.speed}×`;
  simBadge.textContent = `${t(settings.language, 'simulation')} · ${timeSource.label}${speed}`;
  simBadge.hidden = false;
}

function showNotice(text) {
  notice.textContent = text;
  notice.hidden = false;
  window.setTimeout(() => {
    notice.hidden = true;
  }, NOTICE_MS);
}

function applySettings(changedKey = null) {
  root.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[settings.theme]);
  root.classList.toggle('hide-seconds', !settings.showSeconds);
  root.classList.toggle('hide-progress', !settings.showProgress);

  if (changedKey === null || changedKey === 'language') {
    applyTranslations(document, settings.language);
    calendar.setLanguage(settings.language);
    renderSimulationBadge();
  }

  if (changedKey === 'timeZone') {
    // New temporal reference: forget everything rendered for the old zone so
    // nothing is skipped just because a value happens to be equal.
    lastDateKey = null;
    lastSecond = null;
    lastOffset = null;
    lastTitle = '';
  }

  if (changedKey === null || changedKey === 'language' || changedKey === 'timeZone') {
    place = locations.resolve(settings.timeZone, settings.location);
    renderLocation();
  }

  if (changedKey !== null) {
    const now = readNow();
    if (changedKey === 'timeZone') renderDate(now, true); // rings turn to the new date
    else if (changedKey === 'language') digital.renderDate(now, settings.language);
    renderSecond(now);
    analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(performance.now()) });
  }
}

/* ---------- Start ---------- */

function startIntro() {
  root.classList.remove('is-booting');
  if (reducedMotion.matches) return;

  introRunning = true;
  introStart = performance.now();
  root.classList.add('is-intro');
  calendar.playEntrance();
  window.setTimeout(() => {
    introRunning = false;
    root.classList.remove('is-intro');
    calendar.finishEntrance();
  }, INTRO_TOTAL_MS);
}

function start() {
  calendar.enableExploration((node, ring) => tooltips.show(node, 'keyboard', { owner: ring }));
  applySettings();
  const settingsPanel = new SettingsPanel({
    dialog: document.getElementById('settings'),
    openButton: document.getElementById('settings-open'),
    settings,
    onChange: (next, key) => {
      settings = next;
      applySettings(key);
    },
  });

  const picker = new LocationPicker({
    dialog: document.getElementById('location-picker'),
    directory: locations,
    getContext: () => ({
      language: settings.language,
      timeZone: settings.timeZone,
      placeKey: place.key,
      now: timeSource.now(),
      recents: loadRecentLocations(),
    }),
    onSelect: (choice) => settingsPanel.setLocation(choice),
  });
  // The header chip is a shortcut to the picker; the settings card opens it too.
  for (const opener of [locationChip, locationCard]) {
    opener.addEventListener('click', () => picker.open(opener));
  }

  if (storageReport.rejectedTimeZone) {
    showNotice(t(settings.language, 'zoneRejected', storageReport.rejectedTimeZone));
  }

  const now = readNow();
  renderDate(now);
  startIntro();
  renderSecond(now, introRunning ? 0 : 1);
  analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(performance.now()) });
  window.requestAnimationFrame(frame);
}

start();
