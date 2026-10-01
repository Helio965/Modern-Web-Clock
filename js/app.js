/**
 * Application bootstrap and render loop.
 *
 * A single requestAnimationFrame loop reads one São Paulo snapshot per frame
 * from sao-paulo-time.js and hands it to the UI modules. Work is split by how
 * often it really changes:
 *   - every frame:  analog hands (smooth motion)
 *   - every second: digital time and progress indicators
 *   - every date:   calendar rings and the date readout
 * Settings changes re-render only what they affect.
 */

import { getSaoPauloDateTime, getTemporalProgress } from './sao-paulo-time.js';
import { createTimeSource, parseSimulation } from './time-source.js';
import { CalendarRings } from './calendar.js';
import { AnalogClock, DigitalClock } from './clock.js';
import { ProgressPanel } from './progress.js';
import { SettingsPanel, loadSettings } from './settings.js';
import { applyTranslations, formatTimeString, t } from './i18n.js';
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
const THEME_COLORS = { dark: '#0a0b0d', light: '#e7eaee' };

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let settings = loadSettings();

const timeSource = createTimeSource(parseSimulation(window.location.search));
const calendar = new CalendarRings(document.getElementById('clock-rings'));
const analog = new AnalogClock(
  document.getElementById('clock-face-details'),
  document.getElementById('clock-hands'),
);
const digital = new DigitalClock(document.getElementById('digital'));
const progressPanel = new ProgressPanel(document.getElementById('progress'));
const simBadge = document.getElementById('sim-badge');
const tooltips = new TooltipController({
  element: document.getElementById('tooltip'),
  liveRegion: document.getElementById('live-region'),
  getContent: tooltipContent,
});

let lastDateKey = null;
let lastSecond = null;
let lastTitle = '';
let introStart = 0;
let introRunning = false;

const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const readNow = () => getSaoPauloDateTime(timeSource.now());
const timeOptions = () => ({ hour12: settings.hourFormat === '12', showSeconds: settings.showSeconds });

/* ---------- Rendering ---------- */

function renderDate(now) {
  calendar.update(now, { animate: lastDateKey !== null });
  digital.renderDate(now, settings.language);
  analog.setFaceLabels('SÃO PAULO', now.utcOffsetMinutes);
  lastDateKey = now.dateKey;
}

function renderProgress(now, growth = 1) {
  if (!settings.showProgress) return;
  progressPanel.render(now, getTemporalProgress(now), settings.language, growth);
}

function renderTitle(now) {
  const title = `${formatTimeString(now, { ...timeOptions(), showSeconds: false })} · São Paulo — Modern Circular Clock`;
  if (title !== lastTitle) {
    document.title = title;
    lastTitle = title;
  }
}

function renderSecond(now, growth = 1) {
  digital.renderTime(now, timeOptions());
  renderProgress(now, growth);
  renderTitle(now);
  tooltips.refresh();
  lastSecond = now.epochMs - now.milliseconds;
}

/** Tooltip text for whatever element is hovered, tapped or explored. */
function tooltipContent(target) {
  const now = readNow();
  const { language } = settings;
  const { ring } = target.dataset;
  switch (target.dataset.tip) {
    case 'ring-item': {
      const value = Number(target.dataset.index) + 1;
      if (ring === 'days') return describeDay(now, value, language);
      if (ring === 'months') return describeMonth(now, value, language);
      return describeWeekday(now, value, language);
    }
    case 'ring-gap':
      if (ring === 'days') return describeMonthLength(now, language);
      if (ring === 'months') return describeYear(now, language);
      return describeWeek(now, language);
    case 'progress':
      return describeProgress(target.dataset.progressRow, now, getTemporalProgress(now), language);
    case 'face':
      return describeFace(now, language, timeOptions());
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

  if (changedKey !== null) {
    const now = readNow();
    if (changedKey === 'language') digital.renderDate(now, settings.language);
    renderSecond(now);
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
  new SettingsPanel({
    dialog: document.getElementById('settings'),
    openButton: document.getElementById('settings-open'),
    settings,
    onChange: (next, key) => {
      settings = next;
      applySettings(key);
    },
  });

  const now = readNow();
  renderDate(now);
  startIntro();
  renderSecond(now, introRunning ? 0 : 1);
  analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(performance.now()) });
  window.requestAnimationFrame(frame);
}

start();
