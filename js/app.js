/**
 * Application bootstrap and render loop.
 *
 * A single requestAnimationFrame loop reads one São Paulo snapshot per frame
 * from sao-paulo-time.js and hands it to the UI modules. Work is split by how
 * often it really changes:
 *   - every frame:  analog hands (smooth motion)
 *   - every second: digital time
 *   - every date:   calendar rings and the date readout
 */

import { getSaoPauloDateTime } from './sao-paulo-time.js';
import { createTimeSource, parseSimulation } from './time-source.js';
import { CalendarRings } from './calendar.js';
import { AnalogClock, DigitalClock } from './clock.js';

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

function renderSecond(now) {
  digital.renderTime(now, state);
  lastSecond = now.epochMs - now.milliseconds;
}

function introProgress(timestamp) {
  if (!introRunning) return 1;
  return Math.min(1, Math.max(0, (timestamp - introStart - HANDS_INTRO_DELAY_MS) / HANDS_INTRO_MS));
}

function frame(timestamp) {
  const now = getSaoPauloDateTime(timeSource.now());

  if (now.dateKey !== lastDateKey) renderDate(now);
  if (now.epochMs - now.milliseconds !== lastSecond) renderSecond(now);
  analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(timestamp) });

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
  renderSecond(now);
  startIntro();
  analog.render(now, { smooth: !reducedMotion.matches, intro: introProgress(performance.now()) });
  window.requestAnimationFrame(frame);
}

start();
