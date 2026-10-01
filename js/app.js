/**
 * Application bootstrap and render loop.
 *
 * A single requestAnimationFrame loop reads one São Paulo snapshot per frame
 * from sao-paulo-time.js and hands it to the UI modules. Work is split by how
 * often it really changes:
 *   - every frame:  analog hands (smooth motion)
 *   - every second: digital time and progress indicators
 *   - every date:   calendar rings and the date readout
 */

import { getSaoPauloDateTime, getTemporalProgress } from './sao-paulo-time.js';
import { createTimeSource, parseSimulation } from './time-source.js';
import { CalendarRings } from './calendar.js';
import { AnalogClock, DigitalClock } from './clock.js';
import { ProgressPanel } from './progress.js';

const HANDS_INTRO_DELAY_MS = 550;
const HANDS_INTRO_MS = 900;
const INTRO_TOTAL_MS = 1700;

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  language: 'pt',
  hour12: false,
  showSeconds: true,
};

const timeSource = createTimeSource(parseSimulation(window.location.search));
const calendar = new CalendarRings(document.getElementById('clock-rings'));
const analog = new AnalogClock(
  document.getElementById('clock-face-details'),
  document.getElementById('clock-hands'),
);
const digital = new DigitalClock(document.getElementById('digital'));
const progressPanel = new ProgressPanel(document.getElementById('progress'));

let lastDateKey = null;
let lastSecond = null;
let introStart = 0;
let introRunning = false;

function renderDate(now) {
  calendar.update(now, { animate: lastDateKey !== null });
  digital.renderDate(now, state.language);
  analog.setFaceLabels('SÃO PAULO', now.utcOffsetMinutes);
  lastDateKey = now.dateKey;
}

function renderProgress(now, growth = 1) {
  progressPanel.render(now, getTemporalProgress(now), state.language, growth);
}

function renderSecond(now, growth = 1) {
  digital.renderTime(now, state);
  renderProgress(now, growth);
  lastSecond = now.epochMs - now.milliseconds;
}

function introProgress(timestamp) {
  if (!introRunning) return 1;
  return Math.min(1, Math.max(0, (timestamp - introStart - HANDS_INTRO_DELAY_MS) / HANDS_INTRO_MS));
}

const easeOutCubic = (x) => 1 - (1 - x) ** 3;

function frame(timestamp) {
  const now = getSaoPauloDateTime(timeSource.now());
  const intro = introProgress(timestamp);
  const growth = intro < 1 ? easeOutCubic(intro) : 1;

  if (now.dateKey !== lastDateKey) renderDate(now);
  if (now.epochMs - now.milliseconds !== lastSecond) renderSecond(now, growth);
  else if (growth < 1) renderProgress(now, growth);
  analog.render(now, { smooth: !reducedMotion.matches, intro });

  window.requestAnimationFrame(frame);
}

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
  calendar.setLanguage(state.language);
  const now = getSaoPauloDateTime(timeSource.now());
  renderDate(now);
  startIntro();
  renderSecond(now, introRunning ? 0 : 1);
  analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(performance.now()) });
  window.requestAnimationFrame(frame);
}

start();
