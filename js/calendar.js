/**
 * Concentric calendar rings: days of the month (outer), months (middle) and
 * days of the week (inner).
 *
 * Each ring places its items at a fixed angular step, so a month with fewer
 * days leaves a larger "gap" segment (as in the reference design). The ring
 * rotates so that the current value — in the selected time zone — always sits
 * under a fixed highlight window at 12 o'clock; rotations are cumulative, so
 * moving from 31 → 01 or DEZ → JAN keeps turning forward instead of back.
 *
 * The DOM is built once. Updates only toggle classes, swap a few labels and
 * set one CSS transform per ring — nothing is rebuilt per frame.
 */

import { formatLongDate, formatMonthYear, monthShort, t, weekdayLong, weekdayShort } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER = 500;

export const RING_GEOMETRY = Object.freeze({
  days: { radius: 445, band: 64, step: 10, slots: 31, window: 64 },
  months: { radius: 365, band: 64, step: 25, slots: 12, window: 98 },
  weekdays: { radius: 285, band: 64, step: 40, slots: 7, window: 98 },
});

function svg(name, attributes = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (parent) parent.append(node);
  return node;
}

function polar(radius, angleDeg) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}

function arcPath(radius, startDeg, endDeg) {
  const [x1, y1] = polar(radius, startDeg);
  const [x2, y2] = polar(radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Normalizes an angle difference to (-180, 180]. */
function shortestDelta(delta) {
  const wrapped = ((delta % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

class Ring {
  constructor(parent, name, geometry) {
    this.name = name;
    this.geometry = geometry;
    this.count = geometry.slots;
    this.currentIndex = -1;
    this.inspected = -1;
    this.rotation = 0;

    const { radius, band, slots, step, window: windowWidth } = geometry;
    const windowHeight = band - 14;

    this.group = svg('g', { class: `ring ring--${name}`, 'data-ring': name }, parent);
    svg('circle', { class: 'ring__band', cx: CENTER, cy: CENTER, r: radius, 'stroke-width': band }, this.group);
    svg('circle', { class: 'ring__edge', cx: CENTER, cy: CENTER, r: radius + band / 2 }, this.group);
    svg('circle', { class: 'ring__edge', cx: CENTER, cy: CENTER, r: radius - band / 2 }, this.group);

    // Unused slots (e.g. days 29–31 in February) form a lighter gap segment.
    this.gapRotor = svg('g', { class: 'ring__rotor', 'aria-hidden': 'true' }, this.group);
    this.gapLabelHolder = svg('g', { class: 'ring__gap-holder', 'data-ring': name, 'data-tip': 'ring-gap' }, this.gapRotor);
    this.gapArc = svg('path', { class: 'ring__gap', 'stroke-width': band - 16 }, this.gapLabelHolder);
    this.gapHit = svg('path', { class: 'ring__gap-hit', 'stroke-width': band - 8 }, this.gapLabelHolder);
    this.gapLabel = svg('text', { class: 'ring__gap-label', x: CENTER, y: CENTER - radius }, this.gapLabelHolder);

    // Fixed reading window at 12 o'clock.
    this.window = svg('rect', {
      class: 'ring__window',
      x: CENTER - windowWidth / 2,
      y: CENTER - radius - windowHeight / 2,
      width: windowWidth,
      height: windowHeight,
      rx: windowHeight / 2,
    }, this.group);

    this.itemRotor = svg('g', { class: 'ring__rotor', 'aria-hidden': 'true' }, this.group);
    this.items = [];
    const hitWidth = ((2 * Math.PI * radius) / 360) * step * 0.92;
    for (let index = 0; index < slots; index += 1) {
      const item = svg('g', {
        class: 'ring__item',
        transform: `rotate(${index * step} ${CENTER} ${CENTER})`,
        'data-ring': name,
        'data-index': index,
        'data-tip': 'ring-item',
      }, this.itemRotor);
      svg('rect', {
        class: 'ring__hit',
        x: CENTER - hitWidth / 2,
        y: CENTER - radius - (band - 8) / 2,
        width: hitWidth,
        height: band - 8,
        rx: 14,
      }, item);
      const label = svg('text', { class: 'ring__label', x: CENTER, y: CENTER - radius }, item);
      this.items.push({ node: item, label });
    }

    // Outline drawn around the band when the ring has keyboard focus.
    this.focusRing = svg('g', { class: 'ring__focus' }, this.group);
    svg('circle', { cx: CENTER, cy: CENTER, r: radius + band / 2 + 4 }, this.focusRing);
    svg('circle', { cx: CENTER, cy: CENTER, r: radius - band / 2 - 4 }, this.focusRing);

    this.layoutGap();
  }

  setLabels(labels) {
    labels.forEach((text, index) => {
      if (this.items[index].label.textContent !== text) this.items[index].label.textContent = text;
    });
  }

  setGapLabel(text) {
    if (this.gapLabel.textContent !== text) this.gapLabel.textContent = text;
  }

  /** Shows only the first `count` slots (28/29/30/31 days) and resizes the gap. */
  setCount(count) {
    if (count === this.count) return;
    this.count = count;
    this.items.forEach((item, index) => item.node.classList.toggle('is-hidden', index >= count));
    this.layoutGap();
  }

  layoutGap() {
    const { radius, band, step } = this.geometry;
    const gapStart = (this.count - 1) * step + step / 2;
    const gapEnd = 360 - step / 2;
    const capDeg = (((band - 16) / 2) / radius) * (180 / Math.PI) + 1.5;
    this.gapArc.setAttribute('d', arcPath(radius, gapStart + capDeg, gapEnd - capDeg));
    this.gapHit.setAttribute('d', arcPath(radius, gapStart + 1, gapEnd - 1));
    const middle = (gapStart + gapEnd) / 2;
    this.gapLabel.setAttribute('transform', `rotate(${middle} ${CENTER} ${CENTER})`);
  }

  /** Highlights `index`, dims earlier items and turns the ring to put it at the top. */
  setCurrent(index) {
    const changed = index !== this.currentIndex;
    this.items.forEach((item, i) => {
      item.node.classList.toggle('is-current', i === index);
      item.node.classList.toggle('is-past', i < index);
    });

    const target = -index * this.geometry.step;
    this.rotation += shortestDelta(target - this.rotation);
    const transform = `rotate(${this.rotation}deg)`;
    this.itemRotor.style.transform = transform;
    this.gapRotor.style.transform = transform;

    if (changed && this.currentIndex !== -1) {
      this.window.classList.remove('is-arriving');
      // Restart the CSS animation on consecutive changes.
      void this.window.getBoundingClientRect();
      this.window.classList.add('is-arriving');
    }
    this.currentIndex = index;
  }

  /**
   * Keyboard exploration: positions 0..count-1 are the items, position
   * `count` is the gap (month length / year / ISO week). Wraps around.
   * Returns the element to describe.
   */
  inspect(position) {
    const stops = this.count + 1;
    this.inspected = ((position % stops) + stops) % stops;
    this.items.forEach((item, i) => item.node.classList.toggle('is-inspected', i === this.inspected));
    this.gapLabelHolder.classList.toggle('is-inspected', this.inspected === this.count);
    return this.inspected === this.count ? this.gapLabelHolder : this.items[this.inspected].node;
  }

  clearInspection() {
    this.inspected = -1;
    this.items.forEach((item) => item.node.classList.remove('is-inspected'));
    this.gapLabelHolder.classList.remove('is-inspected');
  }

  /** Temporarily offsets the ring (used by the opening animation). */
  setRotationOffset(offsetDeg) {
    const transform = `rotate(${this.rotation + offsetDeg}deg)`;
    this.itemRotor.style.transform = transform;
    this.gapRotor.style.transform = transform;
  }

  restoreRotation() {
    this.setRotationOffset(0);
  }
}

export class CalendarRings {
  constructor(container) {
    this.container = container;
    this.language = null;
    this.dateTime = null;
    this.rings = {
      days: new Ring(container, 'days', RING_GEOMETRY.days),
      months: new Ring(container, 'months', RING_GEOMETRY.months),
      weekdays: new Ring(container, 'weekdays', RING_GEOMETRY.weekdays),
    };
    this.rings.days.setLabels(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')));
  }

  setLanguage(language) {
    if (language === this.language) return;
    this.language = language;
    this.rings.months.setLabels(Array.from({ length: 12 }, (_, i) => monthShort(language, i + 1)));
    this.rings.weekdays.setLabels(Array.from({ length: 7 }, (_, i) => weekdayShort(language, i + 1)));
    if (this.dateTime) this.updateGapLabels(this.dateTime);
  }

  /**
   * Makes each ring focusable; arrows / Home / End move through its items.
   * @param {(node: Element, ring: Element) => void} onInspect
   */
  enableExploration(onInspect) {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    for (const ring of Object.values(this.rings)) {
      ring.group.setAttribute('tabindex', '0');
      ring.group.setAttribute('role', 'group');
      ring.group.addEventListener('focus', () => {
        // Mouse clicks also focus the ring; only keyboard focus starts exploring.
        if (ring.group.matches(':focus-visible')) onInspect(ring.inspect(ring.currentIndex), ring.group);
      });
      ring.group.addEventListener('blur', () => ring.clearInspection());
      ring.group.addEventListener('keydown', (event) => {
        let next;
        if (event.key in moves) next = ring.inspected + moves[event.key];
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = ring.count - 1;
        else return;
        event.preventDefault();
        onInspect(ring.inspect(next), ring.group);
      });
    }
  }

  updateAccessibleLabels(dateTime) {
    const hint = t(this.language, 'ringHint');
    const labels = {
      days: `${t(this.language, 'ringDays')}: ${formatLongDate(this.language, dateTime)}. ${hint}`,
      months: `${t(this.language, 'ringMonths')}: ${formatMonthYear(this.language, dateTime.year, dateTime.month)}. ${hint}`,
      weekdays: `${t(this.language, 'ringWeekdays')}: ${weekdayLong(this.language, dateTime.isoWeekday)}. ${hint}`,
    };
    for (const [name, label] of Object.entries(labels)) this.rings[name].group.setAttribute('aria-label', label);
  }

  updateGapLabels(dateTime) {
    this.rings.days.setGapLabel(t(this.language, 'daysUnit', dateTime.daysInMonth));
    this.rings.months.setGapLabel(String(dateTime.year));
    this.rings.weekdays.setGapLabel(t(this.language, 'weekShort', dateTime.isoWeek));
    this.updateAccessibleLabels(dateTime);
  }

  /**
   * Applies a zoned date. Call it when the date changes (a new day or a new
   * location) or on start; pass animate: false to jump straight there.
   */
  update(dateTime, { animate = true } = {}) {
    this.dateTime = dateTime;
    if (!animate) this.container.classList.add('is-instant');

    this.rings.days.setCount(dateTime.daysInMonth);
    this.rings.days.setCurrent(dateTime.day - 1);
    this.rings.months.setCurrent(dateTime.month - 1);
    this.rings.weekdays.setCurrent(dateTime.isoWeekday - 1);
    this.updateGapLabels(dateTime);
    this.container.setAttribute('data-date', dateTime.dateKey);

    if (!animate) {
      void this.container.getBoundingClientRect();
      this.container.classList.remove('is-instant');
    }
  }

  /** Opening animation: rings start turned away and glide into place. */
  playEntrance(offsets = { days: 120, months: -100, weekdays: 80 }) {
    this.container.classList.add('is-instant');
    for (const [name, offset] of Object.entries(offsets)) this.rings[name].setRotationOffset(offset);
    void this.container.getBoundingClientRect();
    this.container.classList.remove('is-instant');
    this.container.classList.add('is-entering');
    for (const ring of Object.values(this.rings)) ring.restoreRotation();
  }

  finishEntrance() {
    this.container.classList.remove('is-entering');
  }
}
