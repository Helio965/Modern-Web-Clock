/**
 * Location picker: a searchable list (ARIA combobox + listbox) in a modal
 * dialog. Opened from the header chip or from the settings card.
 *
 * Empty search → recent locations and popular places by region.
 * Typing → ranked results from js/locations.js (cities, states, countries,
 * IANA identifiers). Each option shows its current UTC offset, computed by
 * Intl for the current instant (so DST is always reflected).
 *
 * Keyboard: ↑/↓ move through the results, Enter chooses, Escape closes, Tab
 * moves between the search box, the actions and the close button. Mouse and
 * touch: click or tap an option.
 */

import { DEFAULT_LOCATION } from './settings.js';
import { GROUPS, detectDeviceTimeZone, formatLocation } from './locations.js';
import { MS_PER_MINUTE, getUtcOffsetMs, isSameTimeZone } from './zoned-time.js';
import { formatUtcOffset, t } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ANNOUNCE_DELAY_MS = 350;

function checkIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'picker__check');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
  svg.append(path);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class LocationPicker {
  /**
   * @param {{
   *   dialog: HTMLDialogElement,
   *   directory: ReturnType<import('./locations.js').createLocationDirectory>,
   *   getContext: () => { language: string, timeZone: string, placeKey: string | null,
   *                       now: number, recents: Array<{ timeZone: string, location: string | null }> },
   *   onSelect: (choice: { timeZone: string, location: string | null }) => void,
   * }} options
   */
  constructor({ dialog, directory, getContext, onSelect }) {
    this.dialog = dialog;
    this.directory = directory;
    this.getContext = getContext;
    this.onSelect = onSelect;

    this.input = dialog.querySelector('[data-picker-search]');
    this.list = dialog.querySelector('[data-picker-results]');
    this.empty = dialog.querySelector('[data-picker-empty]');
    this.status = dialog.querySelector('[data-picker-status]');
    this.deviceButton = dialog.querySelector('[data-picker-device]');
    this.deviceDetail = dialog.querySelector('[data-picker-device-detail]');
    this.defaultButton = dialog.querySelector('[data-picker-default]');
    this.defaultDetail = dialog.querySelector('[data-picker-default-detail]');

    this.options = [];
    this.activeIndex = -1;
    this.opener = null;
    this.deviceZone = null;
    this.announceTimer = 0;
    this.onViewportResize = () => this.fitToViewport();

    this.input.addEventListener('input', () => {
      this.render();
      this.scheduleAnnouncement();
    });
    this.input.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.list.addEventListener('click', (event) => {
      const node = event.target.closest('[role="option"]');
      if (node) this.choose(this.options[Number(node.dataset.index)].choice);
    });
    this.list.addEventListener('pointermove', (event) => {
      const node = event.target.closest('[role="option"]');
      if (node && event.pointerType === 'mouse') this.setActive(Number(node.dataset.index), { scroll: false });
    });
    this.deviceButton.addEventListener('click', () => {
      // The detected identifier is stored as is; the catalogue key only picks its display name.
      if (this.deviceZone) this.choose({ timeZone: this.deviceZone, location: this.directory.resolve(this.deviceZone).key });
    });
    this.defaultButton.addEventListener('click', () => this.choose({ ...DEFAULT_LOCATION }));
    dialog.querySelector('[data-picker-close]').addEventListener('click', () => this.close());
    // A click on the backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this.close();
    });
    dialog.addEventListener('close', () => this.onClosed());
  }

  /** Opens the picker; focus returns to `opener` when it closes. */
  open(opener = document.activeElement) {
    this.opener = opener;
    this.input.value = '';
    this.renderActions();
    this.render();
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
    window.visualViewport?.addEventListener('resize', this.onViewportResize);
    this.fitToViewport();
    this.input.focus();
    this.list.scrollTop = 0;
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  onClosed() {
    window.visualViewport?.removeEventListener('resize', this.onViewportResize);
    window.clearTimeout(this.announceTimer);
    this.status.textContent = '';
    const { opener } = this;
    this.opener = null;
    if (opener?.isConnected) opener.focus();
  }

  /** Keeps the dialog above an on-screen keyboard (visual viewport height). */
  fitToViewport() {
    const viewport = window.visualViewport;
    if (viewport) this.dialog.style.setProperty('--picker-height', `${Math.round(viewport.height)}px`);
  }

  choose(choice) {
    this.close();
    this.onSelect(choice);
  }

  renderActions() {
    const { language } = this.getContext();
    this.deviceZone = detectDeviceTimeZone();
    this.deviceButton.disabled = !this.deviceZone;
    this.deviceDetail.textContent = this.deviceZone
      ? `${t(language, 'deviceDetected', this.deviceZone)} · ${formatLocation(this.directory.resolve(this.deviceZone), language).medium}`
      : t(language, 'deviceUnavailable');
    const fallback = this.directory.resolve(DEFAULT_LOCATION.timeZone, DEFAULT_LOCATION.location);
    this.defaultDetail.textContent = `${formatLocation(fallback, language).medium} · ${DEFAULT_LOCATION.timeZone}`;
  }

  sections(context) {
    const query = this.input.value.trim();
    if (query) return [{ group: null, locations: this.directory.search(query, { language: context.language }) }];
    const recents = context.recents.map((recent) => this.directory.resolve(recent.timeZone, recent.location));
    return [{ group: 'recent', locations: recents }, ...this.directory.popularGroups()];
  }

  render() {
    const context = this.getContext();
    const query = this.input.value.trim();
    this.options = [];
    const groups = [];
    for (const [sectionIndex, section] of this.sections(context).entries()) {
      if (section.locations.length === 0) continue;
      const group = element('div', 'picker__group');
      group.setAttribute('role', 'group');
      if (section.group) {
        const heading = element('div', 'picker__group-title', GROUPS[section.group][context.language]);
        heading.id = `location-group-${sectionIndex}`;
        heading.setAttribute('role', 'presentation');
        group.setAttribute('aria-labelledby', heading.id);
        group.append(heading);
      }
      for (const location of section.locations) group.append(this.renderOption(location, context));
      groups.push(group);
    }
    this.list.replaceChildren(...groups);

    const count = this.options.length;
    this.empty.hidden = count > 0 || !query;
    this.empty.textContent = count === 0 && query ? t(context.language, 'noResults', query) : '';
    this.input.setAttribute('aria-expanded', String(count > 0));
    // While searching, the best match is active so Enter picks it.
    this.activeIndex = -1;
    this.setActive(query && count > 0 ? 0 : -1, { scroll: false });
  }

  renderOption(location, context) {
    const index = this.options.length;
    const names = formatLocation(location, context.language);
    const selected = (location.key ?? null) === (context.placeKey ?? null)
      && isSameTimeZone(location.zone, context.timeZone);
    const offset = Math.round(getUtcOffsetMs(context.now, location.zone) / MS_PER_MINUTE);

    const option = element('div', 'picker__option');
    option.id = `location-option-${index}`;
    option.dataset.index = String(index);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(selected));
    const main = element('span', 'picker__option-main');
    main.append(element('span', 'picker__option-name', names.full), element('span', 'picker__option-zone', location.zone));
    option.append(main, element('span', 'picker__option-offset', formatUtcOffset(offset)), checkIcon());

    this.options.push({ node: option, choice: { timeZone: location.zone, location: location.key } });
    return option;
  }

  setActive(index, { scroll = true } = {}) {
    this.options[this.activeIndex]?.node.classList.remove('is-active');
    this.activeIndex = index;
    const active = this.options[index];
    if (active) {
      active.node.classList.add('is-active');
      this.input.setAttribute('aria-activedescendant', active.node.id);
      if (scroll) active.node.scrollIntoView({ block: 'nearest' });
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  onKeyDown(event) {
    const count = this.options.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (count === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = this.activeIndex === -1
        ? (step > 0 ? 0 : count - 1)
        : (this.activeIndex + step + count) % count;
      this.setActive(next);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = this.options[this.activeIndex];
      if (target) this.choose(target.choice);
    }
  }

  scheduleAnnouncement() {
    window.clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      const { language } = this.getContext();
      const query = this.input.value.trim();
      const count = this.options.length;
      this.status.textContent = count > 0
        ? t(language, 'resultsCount', count)
        : (query ? t(language, 'noResults', query) : '');
    }, ANNOUNCE_DELAY_MS);
  }
}
