/**
 * Analog hands and digital readout, both fed by São Paulo snapshots.
 */

import { toZonedIsoString } from './sao-paulo-time.js';
import { formatTime, formatUtcOffset, monthShort, weekdayLong } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 500;

/**
 * Continuous hand angles in degrees (0 = 12 o'clock, clockwise).
 *
 *   second = s * 6                       (s includes milliseconds when smooth)
 *   minute = m * 6 + s * 0.1
 *   hour   = (h % 12) * 30 + m * 0.5 + s / 120
 */
export function getHandAngles({ hours, minutes, seconds, milliseconds = 0 }, { smooth = true } = {}) {
  const exactSeconds = seconds + (smooth ? milliseconds / 1000 : 0);
  const exactMinutes = minutes + exactSeconds / 60;
  const exactHours = (hours % 12) + exactMinutes / 60;
  return {
    hour: exactHours * 30,
    minute: exactMinutes * 6,
    second: exactSeconds * 6,
  };
}

const easeOutCubic = (x) => 1 - (1 - x) ** 3;

function svg(name, attributes, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  parent.append(node);
  return node;
}

export class AnalogClock {
  /**
   * @param {SVGGElement} faceDetails group inside the dial for ticks and labels
   * @param {SVGSVGElement} handsLayer  overlay SVG holding the hands
   */
  constructor(faceDetails, handsLayer) {
    for (let i = 0; i < 60; i += 1) {
      const isHour = i % 5 === 0;
      const isQuarter = i % 15 === 0;
      svg('line', {
        class: isHour ? 'tick tick--hour' : 'tick',
        x1: CENTER,
        y1: CENTER - (isQuarter ? 200 : isHour ? 207 : 219),
        x2: CENTER,
        y2: CENTER - 229,
        transform: `rotate(${i * 6} ${CENTER} ${CENTER})`,
      }, faceDetails);
    }
    this.cityLabel = svg('text', { class: 'face-label face-label--city', x: CENTER, y: CENTER - 116 }, faceDetails);
    this.offsetLabel = svg('text', { class: 'face-label face-label--offset', x: CENTER, y: CENTER + 120 }, faceDetails);

    this.hands = {
      hour: handsLayer.querySelector('[data-hand="hour"]'),
      minute: handsLayer.querySelector('[data-hand="minute"]'),
      second: handsLayer.querySelector('[data-hand="second"]'),
    };
  }

  setFaceLabels(city, utcOffsetMinutes) {
    this.cityLabel.textContent = city;
    this.offsetLabel.textContent = formatUtcOffset(utcOffsetMinutes);
  }

  /**
   * @param {object} dateTime São Paulo snapshot
   * @param {{ smooth?: boolean, intro?: number }} options
   *        intro: 0 → 1 while the hands sweep in from 12 o'clock.
   */
  render(dateTime, { smooth = true, intro = 1 } = {}) {
    const angles = getHandAngles(dateTime, { smooth });
    const factor = intro >= 1 ? 1 : easeOutCubic(Math.max(0, intro));
    for (const name of ['hour', 'minute', 'second']) {
      this.hands[name].setAttribute('transform', `rotate(${(angles[name] * factor).toFixed(3)} ${CENTER} ${CENTER})`);
    }
  }
}

export class DigitalClock {
  constructor(root) {
    this.time = root.querySelector('[data-digital="time"]');
    this.hm = root.querySelector('[data-digital="hm"]');
    this.seconds = root.querySelector('[data-digital="seconds"]');
    this.period = root.querySelector('[data-digital="period"]');
    this.day = root.querySelector('[data-digital="day"]');
    this.month = root.querySelector('[data-digital="month"]');
    this.year = root.querySelector('[data-digital="year"]');
    this.weekday = root.querySelector('[data-digital="weekday"]');
    this.offset = root.querySelector('[data-digital="offset"]');
  }

  /** Called once per São Paulo second (and when the format changes). */
  renderTime(dateTime, { hour12 = false, showSeconds = true } = {}) {
    const parts = formatTime(dateTime, { hour12 });
    this.hm.textContent = parts.hm;
    this.seconds.textContent = `:${parts.seconds}`;
    this.seconds.hidden = !showSeconds;
    this.period.textContent = parts.period ? ` ${parts.period}` : '';
    this.period.hidden = !parts.period;
    this.time.setAttribute('datetime', toZonedIsoString(dateTime));
  }

  /** Called when the São Paulo date (or the language) changes. */
  renderDate(dateTime, language) {
    this.day.textContent = String(dateTime.day).padStart(2, '0');
    this.month.textContent = monthShort(language, dateTime.month);
    this.year.textContent = String(dateTime.year);
    this.weekday.textContent = weekdayLong(language, dateTime.isoWeekday).toLocaleUpperCase(language === 'en' ? 'en-US' : 'pt-BR');
    this.offset.textContent = formatUtcOffset(dateTime.utcOffsetMinutes);
  }
}
