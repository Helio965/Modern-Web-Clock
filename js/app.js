/**
 * Application bootstrap and render loop.
 *
 * Every frame reads one São Paulo snapshot from sao-paulo-time.js and hands
 * it to the UI modules. Work is split by how often it really changes:
 *   - per date (rare): calendar rings
 */

import { getSaoPauloDateTime } from './sao-paulo-time.js';
import { createTimeSource, parseSimulation } from './time-source.js';
import { CalendarRings } from './calendar.js';

const timeSource = createTimeSource(parseSimulation(window.location.search));
const calendar = new CalendarRings(document.getElementById('clock-rings'));
const language = 'pt';

let lastDateKey = null;

function frame() {
  const now = getSaoPauloDateTime(timeSource.now());

  if (now.dateKey !== lastDateKey) {
    calendar.update(now, { animate: lastDateKey !== null });
    lastDateKey = now.dateKey;
  }

  window.requestAnimationFrame(frame);
}

calendar.setLanguage(language);
window.requestAnimationFrame(frame);
