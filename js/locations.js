/**
 * Locations: the friendly layer between people and IANA time zones.
 *
 * People pick a *place* ("Tóquio — Japão", "Manaus — Amazonas — Brasil");
 * the app stores and computes with its IANA identifier ("Asia/Tokyo",
 * "America/Manaus"). A country is not a time zone: Brazil, the United States
 * or Australia span several zones, so every entry is a city/region.
 *
 * This module only holds names and identifiers. It never stores UTC offsets
 * or daylight-saving rules — those always come from Intl and the
 * environment's tz database (see zoned-time.js).
 *
 * Besides the curated catalogue, every other zone the environment supports
 * (Intl.supportedValuesOf('timeZone')) is searchable with a name derived from
 * its identifier. When that API is missing, the curated catalogue alone is
 * used as the fallback.
 */

import { canonicalTimeZone, isValidTimeZone } from './zoned-time.js';

const n = (pt, en = pt) => Object.freeze({ pt, en });

export const GROUPS = Object.freeze({
  recent: n('Recentes', 'Recent'),
  brazil: n('Brasil', 'Brazil'),
  'north-america': n('América do Norte', 'North America'),
  'latin-america': n('América Latina', 'Latin America'),
  europe: n('Europa', 'Europe'),
  africa: n('África', 'Africa'),
  asia: n('Ásia', 'Asia'),
  oceania: n('Oceania', 'Oceania'),
  other: n('Outros', 'Other'),
  world: n('Outros fusos', 'Other time zones'),
});

/** Groups shown (with their popular entries) when the search box is empty. */
export const POPULAR_GROUPS = Object.freeze(['brazil', 'north-america', 'europe', 'asia', 'oceania']);

const BR = n('Brasil', 'Brazil');
const US = n('Estados Unidos', 'United States');
const CA = n('Canadá', 'Canada');
const AU = n('Austrália', 'Australia');
const CN = n('China');
const IN = n('Índia', 'India');

/*
 * [key, zone or [zone, ...legacy aliases], city, region, country, group, extras]
 * The first entry listed for a zone is its "primary" name (used when only the
 * zone is known, e.g. the device time zone). Aliases cover engines that only
 * know an older spelling (Europe/Kiev before Europe/Kyiv).
 */
const CATALOGUE = [
  ['sao-paulo', 'America/Sao_Paulo', n('São Paulo'), n('São Paulo'), BR, 'brazil',
    { popular: true, keywords: ['sp', 'horário de brasília', 'brasilia time', 'brt'] }],
  ['rio-de-janeiro', 'America/Sao_Paulo', n('Rio de Janeiro'), n('Rio de Janeiro'), BR, 'brazil'],
  ['brasilia', 'America/Sao_Paulo', n('Brasília'), n('Distrito Federal', 'Federal District'), BR, 'brazil'],
  ['belo-horizonte', 'America/Sao_Paulo', n('Belo Horizonte'), n('Minas Gerais'), BR, 'brazil'],
  ['curitiba', 'America/Sao_Paulo', n('Curitiba'), n('Paraná'), BR, 'brazil'],
  ['porto-alegre', 'America/Sao_Paulo', n('Porto Alegre'), n('Rio Grande do Sul'), BR, 'brazil'],
  ['salvador', 'America/Bahia', n('Salvador'), n('Bahia'), BR, 'brazil'],
  ['recife', 'America/Recife', n('Recife'), n('Pernambuco'), BR, 'brazil'],
  ['fortaleza', 'America/Fortaleza', n('Fortaleza'), n('Ceará'), BR, 'brazil'],
  ['belem', 'America/Belem', n('Belém'), n('Pará'), BR, 'brazil'],
  ['manaus', 'America/Manaus', n('Manaus'), n('Amazonas'), BR, 'brazil', { popular: true }],
  ['porto-velho', 'America/Porto_Velho', n('Porto Velho'), n('Rondônia'), BR, 'brazil'],
  ['boa-vista', 'America/Boa_Vista', n('Boa Vista'), n('Roraima'), BR, 'brazil'],
  ['cuiaba', 'America/Cuiaba', n('Cuiabá'), n('Mato Grosso'), BR, 'brazil', { popular: true }],
  ['campo-grande', 'America/Campo_Grande', n('Campo Grande'), n('Mato Grosso do Sul'), BR, 'brazil'],
  ['rio-branco', 'America/Rio_Branco', n('Rio Branco'), n('Acre'), BR, 'brazil', { popular: true }],
  ['fernando-de-noronha', 'America/Noronha', n('Fernando de Noronha'), n('Pernambuco'), BR, 'brazil',
    { popular: true }],

  ['new-york', 'America/New_York', n('Nova York', 'New York'), null, US, 'north-america',
    { popular: true, keywords: ['nyc', 'eastern time', 'horário do leste'] }],
  ['chicago', 'America/Chicago', n('Chicago'), null, US, 'north-america',
    { popular: true, keywords: ['illinois', 'central time', 'horário central'] }],
  ['denver', 'America/Denver', n('Denver'), null, US, 'north-america',
    { popular: true, keywords: ['colorado', 'mountain time', 'horário das montanhas'] }],
  ['phoenix', 'America/Phoenix', n('Phoenix'), n('Arizona'), US, 'north-america'],
  ['los-angeles', 'America/Los_Angeles', n('Los Angeles'), null, US, 'north-america',
    { popular: true, keywords: ['califórnia', 'california', 'pacific time', 'horário do pacífico'] }],
  ['anchorage', 'America/Anchorage', n('Anchorage'), n('Alasca', 'Alaska'), US, 'north-america'],
  ['honolulu', 'Pacific/Honolulu', n('Honolulu'), n('Havaí', 'Hawaii'), US, 'north-america'],
  ['toronto', 'America/Toronto', n('Toronto'), null, CA, 'north-america',
    { popular: true, keywords: ['ontário', 'ontario'] }],
  ['vancouver', 'America/Vancouver', n('Vancouver'), null, CA, 'north-america',
    { popular: true, keywords: ['colúmbia britânica', 'british columbia'] }],
  ['halifax', 'America/Halifax', n('Halifax'), null, CA, 'north-america', { keywords: ['nova escócia', 'nova scotia'] }],
  ['st-johns', 'America/St_Johns', n('St. John’s'), n('Terra Nova', 'Newfoundland'), CA, 'north-america'],
  ['mexico-city', 'America/Mexico_City', n('Cidade do México', 'Mexico City'), null, n('México', 'Mexico'),
    'north-america', { popular: true }],

  ['buenos-aires', ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'], n('Buenos Aires'), null,
    n('Argentina'), 'latin-america'],
  ['santiago', 'America/Santiago', n('Santiago'), null, n('Chile'), 'latin-america'],
  ['montevideo', 'America/Montevideo', n('Montevidéu', 'Montevideo'), null, n('Uruguai', 'Uruguay'), 'latin-america'],
  ['asuncion', 'America/Asuncion', n('Assunção', 'Asunción'), null, n('Paraguai', 'Paraguay'), 'latin-america'],
  ['la-paz', 'America/La_Paz', n('La Paz'), null, n('Bolívia', 'Bolivia'), 'latin-america'],
  ['lima', 'America/Lima', n('Lima'), null, n('Peru'), 'latin-america'],
  ['bogota', 'America/Bogota', n('Bogotá'), null, n('Colômbia', 'Colombia'), 'latin-america'],
  ['caracas', 'America/Caracas', n('Caracas'), null, n('Venezuela'), 'latin-america'],
  ['panama', 'America/Panama', n('Cidade do Panamá', 'Panama City'), null, n('Panamá', 'Panama'), 'latin-america'],
  ['havana', 'America/Havana', n('Havana'), null, n('Cuba'), 'latin-america'],

  ['london', 'Europe/London', n('Londres', 'London'), null, n('Reino Unido', 'United Kingdom'), 'europe',
    { popular: true, keywords: ['inglaterra', 'england', 'uk', 'gmt', 'bst'] }],
  ['dublin', 'Europe/Dublin', n('Dublin'), null, n('Irlanda', 'Ireland'), 'europe'],
  ['lisbon', 'Europe/Lisbon', n('Lisboa', 'Lisbon'), null, n('Portugal'), 'europe', { popular: true }],
  ['madrid', 'Europe/Madrid', n('Madri', 'Madrid'), null, n('Espanha', 'Spain'), 'europe', { popular: true }],
  ['paris', 'Europe/Paris', n('Paris'), null, n('França', 'France'), 'europe', { popular: true }],
  ['brussels', 'Europe/Brussels', n('Bruxelas', 'Brussels'), null, n('Bélgica', 'Belgium'), 'europe'],
  ['amsterdam', 'Europe/Amsterdam', n('Amsterdã', 'Amsterdam'), null, n('Países Baixos', 'Netherlands'), 'europe',
    { keywords: ['holanda', 'holland'] }],
  ['berlin', 'Europe/Berlin', n('Berlim', 'Berlin'), null, n('Alemanha', 'Germany'), 'europe', { popular: true }],
  ['zurich', 'Europe/Zurich', n('Zurique', 'Zurich'), null, n('Suíça', 'Switzerland'), 'europe'],
  ['rome', 'Europe/Rome', n('Roma', 'Rome'), null, n('Itália', 'Italy'), 'europe', { popular: true }],
  ['vienna', 'Europe/Vienna', n('Viena', 'Vienna'), null, n('Áustria', 'Austria'), 'europe'],
  ['stockholm', 'Europe/Stockholm', n('Estocolmo', 'Stockholm'), null, n('Suécia', 'Sweden'), 'europe'],
  ['warsaw', 'Europe/Warsaw', n('Varsóvia', 'Warsaw'), null, n('Polônia', 'Poland'), 'europe'],
  ['athens', 'Europe/Athens', n('Atenas', 'Athens'), null, n('Grécia', 'Greece'), 'europe'],
  ['kyiv', ['Europe/Kyiv', 'Europe/Kiev'], n('Kiev', 'Kyiv'), null, n('Ucrânia', 'Ukraine'), 'europe'],
  ['istanbul', 'Europe/Istanbul', n('Istambul', 'Istanbul'), null, n('Turquia', 'Türkiye'), 'europe',
    { keywords: ['turkey'] }],
  ['moscow', 'Europe/Moscow', n('Moscou', 'Moscow'), null, n('Rússia', 'Russia'), 'europe', { popular: true }],

  ['cairo', 'Africa/Cairo', n('Cairo'), null, n('Egito', 'Egypt'), 'africa'],
  ['casablanca', 'Africa/Casablanca', n('Casablanca'), null, n('Marrocos', 'Morocco'), 'africa'],
  ['lagos', 'Africa/Lagos', n('Lagos'), null, n('Nigéria', 'Nigeria'), 'africa'],
  ['luanda', 'Africa/Luanda', n('Luanda'), null, n('Angola'), 'africa'],
  ['nairobi', 'Africa/Nairobi', n('Nairóbi', 'Nairobi'), null, n('Quênia', 'Kenya'), 'africa'],
  ['johannesburg', 'Africa/Johannesburg', n('Joanesburgo', 'Johannesburg'), null, n('África do Sul', 'South Africa'),
    'africa'],
  ['maputo', 'Africa/Maputo', n('Maputo'), null, n('Moçambique', 'Mozambique'), 'africa'],

  ['jerusalem', 'Asia/Jerusalem', n('Jerusalém', 'Jerusalem'), null, n('Israel'), 'asia'],
  ['riyadh', 'Asia/Riyadh', n('Riad', 'Riyadh'), null, n('Arábia Saudita', 'Saudi Arabia'), 'asia'],
  ['tehran', 'Asia/Tehran', n('Teerã', 'Tehran'), null, n('Irã', 'Iran'), 'asia'],
  ['dubai', 'Asia/Dubai', n('Dubai'), null, n('Emirados Árabes Unidos', 'United Arab Emirates'), 'asia',
    { popular: true, keywords: ['uae', 'eau'] }],
  ['karachi', 'Asia/Karachi', n('Karachi'), null, n('Paquistão', 'Pakistan'), 'asia'],
  ['new-delhi', ['Asia/Kolkata', 'Asia/Calcutta'], n('Nova Délhi', 'New Delhi'), null, IN, 'asia',
    { popular: true, keywords: ['delhi', 'ist'] }],
  ['mumbai', ['Asia/Kolkata', 'Asia/Calcutta'], n('Mumbai'), null, IN, 'asia', { keywords: ['bombaim', 'bombay'] }],
  ['kathmandu', ['Asia/Kathmandu', 'Asia/Katmandu'], n('Katmandu', 'Kathmandu'), null, n('Nepal'), 'asia'],
  ['dhaka', 'Asia/Dhaka', n('Daca', 'Dhaka'), null, n('Bangladesh'), 'asia'],
  ['bangkok', 'Asia/Bangkok', n('Bangkok'), null, n('Tailândia', 'Thailand'), 'asia', { popular: true }],
  ['jakarta', 'Asia/Jakarta', n('Jacarta', 'Jakarta'), null, n('Indonésia', 'Indonesia'), 'asia'],
  ['ho-chi-minh', ['Asia/Ho_Chi_Minh', 'Asia/Saigon'], n('Ho Chi Minh'), null, n('Vietnã', 'Vietnam'), 'asia',
    { keywords: ['saigon'] }],
  ['singapore', 'Asia/Singapore', n('Singapura', 'Singapore'), null, n('Singapura', 'Singapore'), 'asia',
    { popular: true }],
  ['hong-kong', 'Asia/Hong_Kong', n('Hong Kong'), null, CN, 'asia', { popular: true }],
  ['beijing', 'Asia/Shanghai', n('Pequim', 'Beijing'), null, CN, 'asia', { popular: true }],
  ['shanghai', 'Asia/Shanghai', n('Xangai', 'Shanghai'), null, CN, 'asia'],
  ['taipei', 'Asia/Taipei', n('Taipé', 'Taipei'), null, n('Taiwan'), 'asia'],
  ['manila', 'Asia/Manila', n('Manila'), null, n('Filipinas', 'Philippines'), 'asia'],
  ['seoul', 'Asia/Seoul', n('Seul', 'Seoul'), null, n('Coreia do Sul', 'South Korea'), 'asia', { popular: true }],
  ['tokyo', 'Asia/Tokyo', n('Tóquio', 'Tokyo'), null, n('Japão', 'Japan'), 'asia', { popular: true }],

  ['perth', 'Australia/Perth', n('Perth'), null, AU, 'oceania',
    { popular: true, keywords: ['austrália ocidental', 'western australia'] }],
  ['adelaide', 'Australia/Adelaide', n('Adelaide'), null, AU, 'oceania',
    { keywords: ['austrália meridional', 'south australia'] }],
  ['brisbane', 'Australia/Brisbane', n('Brisbane'), null, AU, 'oceania', { keywords: ['queensland'] }],
  ['sydney', 'Australia/Sydney', n('Sydney'), null, AU, 'oceania',
    { popular: true, keywords: ['nova gales do sul', 'new south wales'] }],
  ['melbourne', 'Australia/Melbourne', n('Melbourne'), null, AU, 'oceania',
    { popular: true, keywords: ['vitória', 'victoria'] }],
  ['auckland', 'Pacific/Auckland', n('Auckland'), null, n('Nova Zelândia', 'New Zealand'), 'oceania',
    { popular: true }],
  ['suva', 'Pacific/Fiji', n('Suva'), null, n('Fiji'), 'oceania'],

  ['utc', 'UTC', n('UTC'), null, n('Tempo Universal Coordenado', 'Coordinated Universal Time'), 'other',
    { keywords: ['gmt', 'zulu', 'universal'] }],
];

/* Areas used to name zones that are not in the curated catalogue. */
const AREAS = {
  Africa: n('África', 'Africa'),
  America: n('Américas', 'Americas'),
  Antarctica: n('Antártida', 'Antarctica'),
  Arctic: n('Ártico', 'Arctic'),
  Asia: n('Ásia', 'Asia'),
  Atlantic: n('Oceano Atlântico', 'Atlantic Ocean'),
  Australia: n('Austrália', 'Australia'),
  Europe: n('Europa', 'Europe'),
  Indian: n('Oceano Índico', 'Indian Ocean'),
  Pacific: n('Oceano Pacífico', 'Pacific Ocean'),
};

/** Lower-case, accent-free, punctuation-free text for matching ("Japão" → "japao"). */
export function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const pick = (names, language) => (names ? names[language] ?? names.pt : null);

function joinDistinct(parts) {
  const out = [];
  for (const part of parts) {
    if (part && part !== out[out.length - 1]) out.push(part);
  }
  return out.join(' — ');
}

/**
 * Display names of a location.
 *   short:  "Tóquio"                      (clock face, tab title)
 *   medium: "Tóquio — Japão"              (header chip)
 *   full:   "Manaus — Amazonas — Brasil"  (panels, picker)
 */
export function formatLocation(location, language) {
  const city = pick(location.city, language);
  const region = pick(location.region, language);
  const country = pick(location.country, language);
  return {
    short: city,
    medium: joinDistinct([city, country]),
    full: joinDistinct([city, region, country]),
  };
}

/** Pre-computed, normalized search data of a location (built once). */
function buildIndex({ zone, aliases, city, region, country, keywords }) {
  const names = [city, region, country].filter(Boolean).flatMap((names) => [names.pt, names.en]);
  return Object.freeze({
    haystack: normalizeText([...names, zone, ...aliases, ...keywords].join(' ')),
    cities: [city.pt, city.en].map(normalizeText),
    names: names.map(normalizeText),
    zone: normalizeText(zone),
    words: normalizeText(names.join(' ')).split(' '),
  });
}

function deriveLocation(zone) {
  const parts = zone.split('/');
  const pretty = (text) => text.replace(/_/g, ' ');
  const city = n(pretty(parts[parts.length - 1]));
  const region = parts.length > 2 ? n(parts.slice(1, -1).map(pretty).join(' / ')) : null;
  const area = parts.length > 1 ? AREAS[parts[0]] ?? n(pretty(parts[0])) : null;
  const location = {
    key: null,
    zone,
    aliases: [],
    city,
    region,
    country: area,
    group: 'world',
    popular: false,
    keywords: [],
    derived: true,
  };
  return Object.freeze({ ...location, index: buildIndex(location) });
}

function defaultListZones() {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : null;
}

/**
 * Builds the searchable directory of locations.
 *
 * @param {{ listZones?: () => (string[] | null) }} [options]
 *        listZones returns every zone the environment supports, or null when
 *        it cannot tell (the curated catalogue is then the fallback).
 */
export function createLocationDirectory({ listZones = defaultListZones } = {}) {
  // Curated entries whose zone (or a legacy alias) this environment supports.
  const catalogue = [];
  for (const [key, zones, city, region, country, group, extras = {}] of CATALOGUE) {
    const candidates = Array.isArray(zones) ? zones : [zones];
    const zone = candidates.find(isValidTimeZone);
    if (!zone) continue;
    const location = {
      key,
      zone,
      aliases: candidates.filter((candidate) => candidate !== zone),
      city,
      region,
      country,
      group,
      popular: Boolean(extras.popular),
      keywords: extras.keywords ?? [],
      derived: false,
    };
    catalogue.push(Object.freeze({ ...location, index: buildIndex(location) }));
  }
  const byKey = new Map(catalogue.map((location) => [location.key, location]));

  const canonicalCache = new Map();
  const canonical = (zone) => {
    if (!canonicalCache.has(zone)) canonicalCache.set(zone, canonicalTimeZone(zone));
    return canonicalCache.get(zone);
  };

  let extended = null;
  /** Curated entries plus every other supported zone (built on first search). */
  function allLocations() {
    if (extended) return extended;
    let zones = null;
    try {
      zones = listZones();
    } catch {
      zones = null;
    }
    // supportedValuesOf() already lists supported, canonical identifiers, so
    // only the curated zones need canonicalizing to skip duplicates such as
    // "Asia/Calcutta" when "Asia/Kolkata" (Nova Délhi) is in the catalogue.
    const known = new Set(catalogue.map((location) => canonical(location.zone)));
    const derived = (zones ?? [])
      .filter((zone) => typeof zone === 'string' && !known.has(zone))
      .map(deriveLocation);
    extended = [...catalogue, ...derived];
    return extended;
  }

  /** First catalogue entry for a zone (exact spelling first, then aliases). */
  function primaryFor(zone) {
    return catalogue.find((location) => location.zone === zone)
      ?? catalogue.find((location) => location.aliases.includes(zone))
      ?? catalogue.find((location) => isValidTimeZone(zone) && canonical(location.zone) === canonical(zone))
      ?? null;
  }

  /**
   * The location to display for a stored preference. A location key is only
   * honoured when it really belongs to the zone; otherwise the zone's primary
   * entry is used, or a name derived from the identifier.
   */
  function resolve(timeZone, locationKey = null) {
    const keyed = locationKey ? byKey.get(locationKey) : null;
    if (keyed && (keyed.zone === timeZone || keyed.aliases.includes(timeZone)
      || (isValidTimeZone(timeZone) && canonical(keyed.zone) === canonical(timeZone)))) {
      return { ...keyed, zone: timeZone };
    }
    const primary = primaryFor(timeZone);
    if (primary) return { ...primary, zone: timeZone };
    return deriveLocation(timeZone);
  }

  /**
   * Ranked search over names (both languages), regions, countries, keywords
   * and identifiers. Every word of the query must match. Ranking:
   * exact city > exact state/country ("brasil", "japão") > city prefix >
   * identifier ("asia/tokyo") > word prefix > anywhere; ties keep popular
   * places first, then catalogue order.
   */
  function search(query, { language = 'pt', limit = 60 } = {}) {
    const normalized = normalizeText(query);
    if (!normalized) return [];
    const tokens = normalized.split(' ');
    const order = new Map(allLocations().map((location, index) => [location, index]));
    const results = [];
    for (const location of allLocations()) {
      const { haystack, cities, names, zone, words } = location.index;
      if (!tokens.every((token) => haystack.includes(token))) continue;
      let score = 5;
      if (cities.includes(normalized)) score = 0;
      else if (names.includes(normalized)) score = 1;
      else if (cities.some((city) => city.startsWith(normalized))) score = 2;
      else if (zone === normalized || zone.endsWith(` ${normalized}`)) score = 3;
      else if (words.some((word) => word.startsWith(tokens[0]))) score = 4;
      results.push({ location, score });
    }
    results.sort((a, b) => a.score - b.score
      || Number(a.location.derived) - Number(b.location.derived)
      || Number(b.location.popular) - Number(a.location.popular)
      || (a.location.derived
        ? pick(a.location.city, language).localeCompare(pick(b.location.city, language), language)
        : order.get(a.location) - order.get(b.location)));
    return results.slice(0, limit).map((result) => result.location);
  }

  /** Popular entries grouped for the empty-search state. */
  function popularGroups() {
    return POPULAR_GROUPS.map((group) => ({
      group,
      locations: catalogue.filter((location) => location.group === group && location.popular),
    })).filter((entry) => entry.locations.length > 0);
  }

  return Object.freeze({
    catalogue: Object.freeze(catalogue),
    get: (key) => byKey.get(key) ?? null,
    allLocations,
    primaryFor,
    resolve,
    search,
    popularGroups,
  });
}

/** Shared directory used by the app. */
export const locations = createLocationDirectory();

/**
 * The device's own IANA zone, or null when it cannot be determined or is not
 * supported. Only used when the person explicitly asks for it.
 */
export function detectDeviceTimeZone(resolver = () => Intl.DateTimeFormat().resolvedOptions().timeZone) {
  try {
    const zone = resolver();
    return isValidTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}
