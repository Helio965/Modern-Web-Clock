/**
 * Temporal progress widget: four concentric arcs (year → day, outside in)
 * plus a legend with percentages. Values come from getTemporalProgress().
 */

import { formatDuration, formatPercent, t, weekdayLong } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 100;
const STROKE = 11;

export const PROGRESS_KEYS = Object.freeze(['day', 'week', 'month', 'year']);

const RADII = { year: 86, month: 70, week: 54, day: 38 };

function svg(name, attributes, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  parent.append(node);
  return node;
}

/** Time left until São Paulo midnight, rounded up so "now + remaining" is exactly 24:00. */
export function timeUntilMidnight(dateTime, progress) {
  return formatDuration(Math.ceil((progress.bounds.day.end - dateTime.epochMs) / 1000) * 1000);
}

/** Short contextual line shown under each percentage. */
export function progressDetail(key, dateTime, progress, language) {
  switch (key) {
    case 'day':
      return t(language, 'timeLeft', timeUntilMidnight(dateTime, progress));
    case 'week':
      return t(language, 'weekdayOfWeek', weekdayLong(language, dateTime.isoWeekday), dateTime.isoWeekday);
    case 'month':
      return t(language, 'dayOfTotal', dateTime.day, dateTime.daysInMonth);
    case 'year':
      return t(language, 'dayOfTotal', dateTime.dayOfYear, dateTime.daysInYear);
    default:
      return '';
  }
}

export class ProgressPanel {
  constructor(root) {
    this.root = root;
    const rings = root.querySelector('[data-progress="rings"]');
    this.arcs = {};
    for (const key of ['year', 'month', 'week', 'day']) {
      const radius = RADII[key];
      const circumference = 2 * Math.PI * radius;
      svg('circle', { class: 'progress-track', cx: CENTER, cy: CENTER, r: radius, 'stroke-width': STROKE }, rings);
      const arc = svg('circle', {
        class: `progress-arc progress-arc--${key}`,
        cx: CENTER,
        cy: CENTER,
        r: radius,
        'stroke-width': STROKE,
        'stroke-dasharray': circumference.toFixed(3),
        'stroke-dashoffset': circumference.toFixed(3),
        transform: `rotate(-90 ${CENTER} ${CENTER})`,
        'data-progress-key': key,
      }, rings);
      this.arcs[key] = { arc, circumference };
    }

    this.rows = {};
    for (const row of root.querySelectorAll('[data-progress-row]')) {
      this.rows[row.dataset.progressRow] = {
        row,
        value: row.querySelector('[data-progress-value]'),
        detail: row.querySelector('[data-progress-detail]'),
      };
    }
  }

  /**
   * @param {object} dateTime São Paulo snapshot
   * @param {ReturnType<import('./sao-paulo-time.js').getTemporalProgress>} progress
   * @param {string} language
   * @param {number} [growth=1] 0 → 1 while the arcs grow in during the intro
   */
  render(dateTime, progress, language, growth = 1) {
    for (const key of PROGRESS_KEYS) {
      const fraction = progress[key];
      const { arc, circumference } = this.arcs[key];
      arc.setAttribute('stroke-dashoffset', (circumference * (1 - fraction * growth)).toFixed(3));

      const { row, value, detail } = this.rows[key];
      const text = formatPercent(language, fraction);
      if (value.textContent !== text) value.textContent = text;
      const description = progressDetail(key, dateTime, progress, language);
      if (detail.textContent !== description) detail.textContent = description;
      row.setAttribute('aria-valuenow', (fraction * 100).toFixed(2));
      row.setAttribute('aria-valuetext', text);
    }
  }
}
