/**
 * Contextual tooltips for rings, progress rows and the clock face.
 *
 * The describe*() functions are pure: they turn a São Paulo snapshot into
 * { title, lines, accent } and are unit tested. TooltipController handles
 * mouse hover, touch (tap to show, auto-hide) and keyboard exploration, and
 * mirrors keyboard-driven content into an aria-live region.
 */

import { addDays, daysBetween, daysInMonth, isoWeekday } from './zoned-time.js';
import {
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  formatPercent,
  formatTimeString,
  formatUtcOffset,
  ordinal,
  relativeDay,
  t,
  weekdayLong,
} from './i18n.js';
import { timeUntilMidnight } from './progress.js';

/* ---------------------------------------------------------------------------
 * Content builders
 * ------------------------------------------------------------------------ */

/** Any day of the current São Paulo month (day = 1..31). */
export function describeDay(dateTime, day, language) {
  const date = { year: dateTime.year, month: dateTime.month, day };
  const weekday = weekdayLong(language, isoWeekday(date.year, date.month, date.day));
  return {
    title: formatLongDate(language, date),
    lines: [`${weekday} · ${relativeDay(language, daysBetween(dateTime, date))}`, t(language, 'location')],
    accent: 'day',
  };
}

/** Any month of the current São Paulo year (month = 1..12). */
export function describeMonth(dateTime, month, language) {
  const diff = month - dateTime.month;
  let relative = t(language, 'currentMonth');
  if (diff > 0) relative = t(language, 'inMonths', diff);
  if (diff < 0) relative = t(language, 'monthsAgo', -diff);
  return {
    title: formatMonthYear(language, dateTime.year, month),
    lines: [t(language, 'monthDays', daysInMonth(dateTime.year, month)), relative],
    accent: 'month',
  };
}

/** A day of the current ISO week (isoDay = 1 Monday .. 7 Sunday). */
export function describeWeekday(dateTime, isoDay, language) {
  const diff = isoDay - dateTime.isoWeekday;
  return {
    title: weekdayLong(language, isoDay),
    lines: [formatLongDate(language, addDays(dateTime, diff)), relativeDay(language, diff)],
    accent: 'week',
  };
}

/** Gap of the days ring: the month as a whole. */
export function describeMonthLength(dateTime, language) {
  return {
    title: formatMonthYear(language, dateTime.year, dateTime.month),
    lines: [
      t(language, 'monthDays', dateTime.daysInMonth),
      t(language, 'daysLeftInMonth', dateTime.daysInMonth - dateTime.day),
    ],
    accent: 'day',
  };
}

/** Gap of the months ring: the year. */
export function describeYear(dateTime, language) {
  return {
    title: String(dateTime.year),
    lines: [
      t(language, 'dayOfYear', ordinal(language, dateTime.dayOfYear)),
      t(language, 'daysLeftInYear', dateTime.daysInYear - dateTime.dayOfYear),
      t(language, dateTime.isLeapYear ? 'leapYear' : 'commonYear'),
    ],
    accent: 'year',
  };
}

/** Gap of the weekdays ring: the ISO week. */
export function describeWeek(dateTime, language) {
  const monday = addDays(dateTime, 1 - dateTime.isoWeekday);
  const sunday = addDays(monday, 6);
  return {
    title: t(language, 'isoWeekTitle', dateTime.isoWeek, dateTime.isoWeekYear),
    lines: [`${formatDayMonth(language, monday)} – ${formatDayMonth(language, sunday)}`, t(language, 'weekRange')],
    accent: 'week',
  };
}

const PROGRESS_TITLES = {
  day: 'progressDayLong',
  week: 'progressWeekLong',
  month: 'progressMonthLong',
  year: 'progressYearLong',
};

export function describeProgress(key, dateTime, progress, language) {
  const linesByKey = {
    day: [t(language, 'untilMidnight', timeUntilMidnight(dateTime, progress))],
    week: [t(language, 'weekdayOfWeek', weekdayLong(language, dateTime.isoWeekday), dateTime.isoWeekday)],
    month: [
      t(language, 'dayOfTotal', dateTime.day, dateTime.daysInMonth),
      t(language, 'daysLeftInMonth', dateTime.daysInMonth - dateTime.day),
    ],
    year: [
      t(language, 'dayOfYear', ordinal(language, dateTime.dayOfYear)),
      t(language, 'daysLeftInYear', dateTime.daysInYear - dateTime.dayOfYear),
    ],
  };
  return {
    title: `${t(language, PROGRESS_TITLES[key])} · ${formatPercent(language, progress[key], 4)}`,
    lines: [...linesByKey[key], t(language, 'location')],
    accent: key,
  };
}

export function describeFace(dateTime, language, { hour12 = false } = {}) {
  return {
    title: formatTimeString(dateTime, { hour12, showSeconds: true }),
    lines: [t(language, 'spTime'), `America/Sao_Paulo · ${formatUtcOffset(dateTime.utcOffsetMinutes)}`],
    accent: 'neutral',
  };
}

export const toSpeech = ({ title, lines }) => [title, ...lines].join('. ');

/* ---------------------------------------------------------------------------
 * Controller
 * ------------------------------------------------------------------------ */

const TARGET_SELECTOR = '[data-tip]';
const TOUCH_HIDE_MS = 4000;
const GAP = 10;
const MARGIN = 8;

export class TooltipController {
  /**
   * @param {{ element: HTMLElement, liveRegion: HTMLElement,
   *           getContent: (target: Element) => ({ title: string, lines: string[], accent: string } | null) }} options
   */
  constructor({ element, liveRegion, getContent }) {
    this.element = element;
    this.liveRegion = liveRegion;
    this.getContent = getContent;
    this.active = null;
    this.touchTimer = 0;

    document.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'touch') return;
      const target = event.target.closest?.(TARGET_SELECTOR);
      if (target) this.show(target, 'pointer');
    });
    document.addEventListener('pointerout', (event) => {
      if (event.pointerType === 'touch' || this.active?.source !== 'pointer') return;
      const from = event.target.closest?.(TARGET_SELECTOR);
      const to = event.relatedTarget?.closest?.(TARGET_SELECTOR);
      if (from && from !== to && !to) this.hide();
    });
    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest?.(TARGET_SELECTOR);
      if (event.pointerType === 'touch' && target) {
        this.show(target, 'touch');
        window.clearTimeout(this.touchTimer);
        this.touchTimer = window.setTimeout(() => this.hide(), TOUCH_HIDE_MS);
      } else if (!target && this.active?.source !== 'keyboard') {
        this.hide();
      }
    });
    document.addEventListener('focusin', (event) => {
      const target = event.target.closest?.(TARGET_SELECTOR);
      if (target && target.matches('[tabindex]:focus-visible')) this.show(target, 'keyboard');
    });
    document.addEventListener('focusout', (event) => {
      if (this.active?.source === 'keyboard' && this.active.owner === event.target) this.hide();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.active) this.hide();
    });
    window.addEventListener('scroll', () => this.reposition(), { passive: true });
    window.addEventListener('resize', () => this.reposition(), { passive: true });
  }

  /**
   * @param {Element} target element carrying data-tip (what is described)
   * @param {'pointer'|'touch'|'keyboard'} source
   * @param {{ anchor?: Element, owner?: Element }} [options]
   *        anchor: element to position against; owner: focused element whose
   *        blur closes a keyboard tooltip (e.g. the ring being explored).
   */
  show(target, source, { anchor = target, owner = target } = {}) {
    const content = this.getContent(target);
    if (!content) {
      this.hide();
      return;
    }
    this.active = { target, anchor, owner, source };
    this.render(content);
    if (source === 'keyboard') this.liveRegion.textContent = toSpeech(content);
  }

  hide() {
    this.active = null;
    this.element.hidden = true;
    window.clearTimeout(this.touchTimer);
  }

  /** Re-reads the content of the open tooltip (e.g. once per second). */
  refresh() {
    if (!this.active) return;
    const content = this.getContent(this.active.target);
    if (content) this.render(content);
  }

  render({ title, lines, accent }) {
    const titleNode = document.createElement('strong');
    titleNode.className = 'tooltip__title';
    titleNode.textContent = title;
    const lineNodes = lines.map((line) => {
      const node = document.createElement('span');
      node.className = 'tooltip__line';
      node.textContent = line;
      return node;
    });
    this.element.replaceChildren(titleNode, ...lineNodes);
    this.element.dataset.accent = accent;
    this.element.hidden = false;
    this.reposition();
  }

  reposition() {
    if (!this.active) return;
    const rect = this.active.anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = this.element;
    const left = Math.min(
      Math.max(MARGIN, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - MARGIN,
    );
    let top = rect.top - height - GAP;
    if (top < MARGIN) top = Math.min(rect.bottom + GAP, window.innerHeight - height - MARGIN);
    this.element.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
}
