/**
 * Analog hands and digital readout, both fed by snapshots of the selected
 * time zone (see zoned-time.js). Nothing here knows which zone it is.
 */

import { toZonedIsoString } from './zoned-time.js';
import { formatTime, formatUtcOffset, monthShort, weekdayLong } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 500;

// The city label sits 116 units above the centre; the tick marks at 2 and 10
// o'clock leave about 300 units of free width at that height.
const CITY_MAX_WIDTH = 300;
const CITY_FONT_SIZE = 18;
const CITY_LETTER_SPACING = 7;
const CITY_MIN_SCALE = 0.45;

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

  /**
   * Location name on the face ("SÃO PAULO", "TÓQUIO"...). Long names are
   * scaled down (font size and spacing together) to stay inside the face.
   */
  setCity(name) {
    const label = this.cityLabel;
    if (label.textContent === name && !label.style.fontSize) return;
    label.textContent = name;
    label.style.fontSize = '';
    label.style.letterSpacing = '';
    let width = 0;
    try {
      width = label.getComputedTextLength();
    } catch {
      return; // not rendered (e.g. hidden): keep the default size
    }
    if (width > CITY_MAX_WIDTH) {
      const scale = Math.max(CITY_MIN_SCALE, CITY_MAX_WIDTH / width);
      label.style.fontSize = `${(CITY_FONT_SIZE * scale).toFixed(2)}px`;
      label.style.letterSpacing = `${(CITY_LETTER_SPACING * scale).toFixed(2)}px`;
    }
  }

  /** Current UTC offset under the centre; changes on DST transitions too. */
  setOffset(utcOffsetMinutes) {
    this.offsetLabel.textContent = formatUtcOffset(utcOffsetMinutes);
  }

  /**
   * @param {object} dateTime zoned snapshot
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

  /** Called once per second of the zoned clock (and when the format changes). */
  renderTime(dateTime, { hour12 = false, showSeconds = true } = {}) {
    const parts = formatTime(dateTime, { hour12 });
    this.hm.textContent = parts.hm;
    this.seconds.textContent = `:${parts.seconds}`;
    this.seconds.hidden = !showSeconds;
    this.period.textContent = parts.period ? ` ${parts.period}` : '';
    this.period.hidden = !parts.period;
    this.time.setAttribute('datetime', toZonedIsoString(dateTime));
  }

  /** Called when the date (or the language, or the zone) changes. */
  renderDate(dateTime, language) {
    this.day.textContent = String(dateTime.day).padStart(2, '0');
    this.month.textContent = monthShort(language, dateTime.month);
    this.year.textContent = String(dateTime.year);
    this.weekday.textContent = weekdayLong(language, dateTime.isoWeekday).toLocaleUpperCase(language === 'en' ? 'en-US' : 'pt-BR');
  }

  /** Called when the UTC offset changes (zone switch or DST transition). */
  renderOffset(utcOffsetMinutes) {
    this.offset.textContent = formatUtcOffset(utcOffsetMinutes);
  }
}
