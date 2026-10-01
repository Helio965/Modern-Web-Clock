/**
 * Interface languages (Português / English) and text formatting helpers.
 *
 * Language only changes how values are written. Every value still comes from
 * sao-paulo-time.js, so switching language never changes the time zone.
 */

const pad2 = (value) => String(value).padStart(2, '0');

const plural = (n, one, many) => (n === 1 ? one : many);

const DICTIONARIES = {
  pt: {
    locale: 'pt-BR',
    monthsShort: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
    monthsLong: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
      'outubro', 'novembro', 'dezembro'],
    // ISO order: index 0 = Monday ... 6 = Sunday
    weekdaysShort: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'],
    weekdaysLong: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
      'Domingo'],
    text: {
      location: 'São Paulo — Brasil',
      spTime: 'Horário de São Paulo',
      clockLabel: 'Relógio circular no horário de São Paulo',
      ringDays: 'Dias do mês',
      ringMonths: 'Meses',
      ringWeekdays: 'Dias da semana',
      ringHint: 'Use as setas para explorar.',
      daysUnit: (n) => `${n} DIAS`,
      weekShort: (n) => `SEM ${n}`,
      today: 'Hoje',
      tomorrow: 'Amanhã',
      yesterday: 'Ontem',
      inDays: (n) => `Em ${n} dias`,
      daysAgo: (n) => `Há ${n} dias`,
      currentMonth: 'Mês atual',
      inMonths: (n) => `Em ${n} ${plural(n, 'mês', 'meses')}`,
      monthsAgo: (n) => `Há ${n} ${plural(n, 'mês', 'meses')}`,
      monthDays: (n) => `${n} dias`,
      daysLeftInMonth: (n) => (n === 0 ? 'Último dia do mês' : `${n} ${plural(n, 'dia restante', 'dias restantes')} no mês`),
      dayOfYear: (ord) => `${ord} dia do ano`,
      daysLeftInYear: (n) => (n === 0 ? 'Último dia do ano' : `${n} ${plural(n, 'dia restante', 'dias restantes')}`),
      leapYear: 'Ano bissexto · 366 dias',
      commonYear: 'Ano comum · 365 dias',
      isoWeekTitle: (week, year) => `Semana ${week} de ${year}`,
      weekRange: 'Segunda a domingo',
      progressTitle: 'Progresso',
      progressDay: 'Dia',
      progressWeek: 'Semana',
      progressMonth: 'Mês',
      progressYear: 'Ano',
      progressDayLong: 'Progresso do dia',
      progressWeekLong: 'Progresso da semana',
      progressMonthLong: 'Progresso do mês',
      progressYearLong: 'Progresso do ano',
      untilMidnight: (time) => `Faltam ${time} para a meia-noite`,
      timeLeft: (time) => `Faltam ${time}`,
      weekdayOfWeek: (name, n) => `${name} · dia ${n} de 7`,
      dayOfTotal: (n, total) => `Dia ${n} de ${total}`,
      settings: 'Configurações',
      openSettings: 'Abrir configurações',
      close: 'Fechar',
      theme: 'Tema',
      themeDark: 'Escuro',
      themeLight: 'Claro',
      hourFormat: 'Formato',
      language: 'Idioma',
      seconds: 'Segundos',
      show: 'Mostrar',
      hide: 'Ocultar',
      progressSetting: 'Indicadores de progresso',
      zone: 'Fuso',
      zoneFixed: 'Fixo',
      zoneNote: 'O instante atual vem do relógio do dispositivo e é sempre convertido para America/Sao_Paulo. O fuso não é configurável.',
      simulation: 'Simulação',
    },
  },
  en: {
    locale: 'en-US',
    monthsShort: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December'],
    weekdaysShort: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    text: {
      location: 'São Paulo — Brazil',
      spTime: 'São Paulo time',
      clockLabel: 'Circular clock in São Paulo time',
      ringDays: 'Days of the month',
      ringMonths: 'Months',
      ringWeekdays: 'Days of the week',
      ringHint: 'Use the arrow keys to explore.',
      daysUnit: (n) => `${n} DAYS`,
      weekShort: (n) => `WK ${n}`,
      today: 'Today',
      tomorrow: 'Tomorrow',
      yesterday: 'Yesterday',
      inDays: (n) => `In ${n} days`,
      daysAgo: (n) => `${n} days ago`,
      currentMonth: 'Current month',
      inMonths: (n) => `In ${n} ${plural(n, 'month', 'months')}`,
      monthsAgo: (n) => `${n} ${plural(n, 'month', 'months')} ago`,
      monthDays: (n) => `${n} days`,
      daysLeftInMonth: (n) => (n === 0 ? 'Last day of the month' : `${n} ${plural(n, 'day', 'days')} left this month`),
      dayOfYear: (ord) => `${ord} day of the year`,
      daysLeftInYear: (n) => (n === 0 ? 'Last day of the year' : `${n} ${plural(n, 'day', 'days')} left`),
      leapYear: 'Leap year · 366 days',
      commonYear: 'Common year · 365 days',
      isoWeekTitle: (week, year) => `Week ${week} of ${year}`,
      weekRange: 'Monday to Sunday',
      progressTitle: 'Progress',
      progressDay: 'Day',
      progressWeek: 'Week',
      progressMonth: 'Month',
      progressYear: 'Year',
      progressDayLong: 'Day progress',
      progressWeekLong: 'Week progress',
      progressMonthLong: 'Month progress',
      progressYearLong: 'Year progress',
      untilMidnight: (time) => `${time} until midnight`,
      timeLeft: (time) => `${time} left`,
      weekdayOfWeek: (name, n) => `${name} · day ${n} of 7`,
      dayOfTotal: (n, total) => `Day ${n} of ${total}`,
      settings: 'Settings',
      openSettings: 'Open settings',
      close: 'Close',
      theme: 'Theme',
      themeDark: 'Dark',
      themeLight: 'Light',
      hourFormat: 'Format',
      language: 'Language',
      seconds: 'Seconds',
      show: 'Show',
      hide: 'Hide',
      progressSetting: 'Progress indicators',
      zone: 'Time zone',
      zoneFixed: 'Fixed',
      zoneNote: 'The current instant comes from the device clock and is always converted to America/Sao_Paulo. The time zone cannot be changed.',
      simulation: 'Simulation',
    },
  },
};

export const LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));
export const DEFAULT_LANGUAGE = 'pt';

export function getDictionary(language) {
  return DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];
}

/** Translates a key; function entries receive the extra arguments. */
export function t(language, key, ...args) {
  const entry = getDictionary(language).text[key];
  if (entry === undefined) return key;
  return typeof entry === 'function' ? entry(...args) : entry;
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export function monthShort(language, month) {
  return getDictionary(language).monthsShort[month - 1];
}

export function weekdayShort(language, isoWeekday) {
  return getDictionary(language).weekdaysShort[isoWeekday - 1];
}

export function weekdayLong(language, isoWeekday) {
  return getDictionary(language).weekdaysLong[isoWeekday - 1];
}

/** "01 OUT 2026" / "01 OCT 2026" */
export function formatShortDate(language, { year, month, day }) {
  return `${pad2(day)} ${monthShort(language, month)} ${year}`;
}

/** "1 de outubro de 2026" / "October 1, 2026" */
export function formatLongDate(language, { year, month, day }) {
  const monthName = getDictionary(language).monthsLong[month - 1];
  return language === 'en' ? `${monthName} ${day}, ${year}` : `${day} de ${monthName} de ${year}`;
}

/** "Outubro de 2026" / "October 2026" */
export function formatMonthYear(language, year, month) {
  const monthName = capitalize(getDictionary(language).monthsLong[month - 1]);
  return language === 'en' ? `${monthName} ${year}` : `${monthName} de ${year}`;
}

/** "1 out" / "Oct 1" — compact date used in week ranges. */
export function formatDayMonth(language, { month, day }) {
  const short = monthShort(language, month);
  return language === 'en'
    ? `${capitalize(short.toLowerCase())} ${day}`
    : `${day} ${short.toLocaleLowerCase('pt-BR')}`;
}

/** "274º" / "274th" */
export function ordinal(language, n) {
  if (language !== 'en') return `${n}º`;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Relative day wording for a difference in whole days (0 = today). */
export function relativeDay(language, diff) {
  if (diff === 0) return t(language, 'today');
  if (diff === 1) return t(language, 'tomorrow');
  if (diff === -1) return t(language, 'yesterday');
  return diff > 0 ? t(language, 'inDays', diff) : t(language, 'daysAgo', -diff);
}

/**
 * Digital time parts for a São Paulo snapshot.
 * 24h → { hm: "13:42", seconds: "18", period: null }
 * 12h → { hm: "01:42", seconds: "18", period: "PM" }
 */
export function formatTime({ hours, minutes, seconds }, { hour12 = false } = {}) {
  const displayHours = hour12 ? hours % 12 || 12 : hours;
  return {
    hm: `${pad2(displayHours)}:${pad2(minutes)}`,
    seconds: pad2(seconds),
    period: hour12 ? (hours < 12 ? 'AM' : 'PM') : null,
  };
}

/** Full time string, e.g. "13:42:18", "01:42 PM". */
export function formatTimeString(dateTime, { hour12 = false, showSeconds = true } = {}) {
  const parts = formatTime(dateTime, { hour12 });
  const base = showSeconds ? `${parts.hm}:${parts.seconds}` : parts.hm;
  return parts.period ? `${base} ${parts.period}` : base;
}

/** "UTC−03:00" (uses a true minus sign). */
export function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '−' : '+';
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** "08:34:30" for a duration in milliseconds. */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(totalSeconds % 60)}`;
}

const percentFormatters = new Map();

/** Locale-aware percentage: "57,31%" / "57.31%". */
export function formatPercent(language, fraction, digits = 2) {
  const key = `${language}:${digits}`;
  if (!percentFormatters.has(key)) {
    percentFormatters.set(key, new Intl.NumberFormat(getDictionary(language).locale, {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }));
  }
  // Truncate instead of rounding so 99.999% never shows as 100.00% early
  // (the epsilon absorbs float noise such as 0.29 * 1e4 = 2899.9999…).
  const factor = 10 ** (digits + 2);
  return percentFormatters.get(key).format(Math.floor(fraction * factor + 1e-6) / factor);
}

/**
 * Translates static markup: [data-i18n] sets text, [data-i18n-aria-label]
 * sets aria-label. Also updates <html lang>.
 */
export function applyTranslations(root, language) {
  const { locale } = getDictionary(language);
  document.documentElement.lang = locale;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(language, node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-aria-label]')) {
    node.setAttribute('aria-label', t(language, node.dataset.i18nAriaLabel));
  }
}
