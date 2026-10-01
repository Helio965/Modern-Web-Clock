import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getTemporalProgress, getZonedDateTime } from '../js/zoned-time.js';
import {
  describeDay,
  describeFace,
  describeMonth,
  describeMonthLength,
  describeProgress,
  describeWeek,
  describeWeekday,
  describeYear,
  toSpeech,
} from '../js/tooltip.js';

// 2026-10-01 15:25:30 in São Paulo (already Oct 2nd in Tokyo).
const instant = Date.parse('2026-10-01T18:25:30Z');
const now = getZonedDateTime(instant, 'America/Sao_Paulo');
const SP_LABEL = 'São Paulo — Brasil';

describe('tooltip content (São Paulo date)', () => {
  test('current day', () => {
    assert.deepEqual(describeDay(now, 1, 'pt', SP_LABEL), {
      title: '1 de outubro de 2026',
      lines: ['Quinta-feira · Hoje', 'São Paulo — Brasil'],
      accent: 'day',
    });
    assert.deepEqual(describeDay(now, 1, 'en', 'São Paulo — Brazil').lines, ['Thursday · Today', 'São Paulo — Brazil']);
    assert.equal(describeDay(now, 1, 'pt').lines[1], 'America/Sao_Paulo', 'zone id when no name is given');
  });

  test('other days of the month are relative to today', () => {
    assert.deepEqual(describeDay(now, 15, 'pt').lines[0], 'Quinta-feira · Em 14 dias');
    assert.deepEqual(describeDay(now, 2, 'pt').lines[0], 'Sexta-feira · Amanhã');
  });

  test('months: length and relative position', () => {
    assert.deepEqual(describeMonth(now, 10, 'pt'), {
      title: 'Outubro de 2026', lines: ['31 dias', 'Mês atual'], accent: 'month',
    });
    assert.deepEqual(describeMonth(now, 2, 'pt').lines, ['28 dias', 'Há 8 meses']);
    assert.deepEqual(describeMonth(now, 11, 'en').lines, ['30 days', 'In 1 month']);
  });

  test('weekdays map to dates of the current ISO week', () => {
    assert.deepEqual(describeWeekday(now, 1, 'pt').lines, ['28 de setembro de 2026', 'Há 3 dias']);
    assert.deepEqual(describeWeekday(now, 7, 'en').lines, ['October 4, 2026', 'In 3 days']);
  });

  test('year: day of year and days remaining', () => {
    assert.deepEqual(describeYear(now, 'pt'), {
      title: '2026',
      lines: ['274º dia do ano', '91 dias restantes', 'Ano comum · 365 dias'],
      accent: 'year',
    });
    assert.equal(describeYear(now, 'en').lines[0], '274th day of the year');
  });

  test('month length and ISO week gaps', () => {
    assert.deepEqual(describeMonthLength(now, 'pt').lines, ['31 dias', '30 dias restantes no mês']);
    assert.deepEqual(describeWeek(now, 'pt'), {
      title: 'Semana 40 de 2026', lines: ['28 set – 4 out', 'Segunda a domingo'], accent: 'week',
    });
  });

  test('progress and face', () => {
    const progress = getTemporalProgress(now);
    const day = describeProgress('day', now, progress, 'pt', SP_LABEL);
    assert.match(day.title, /^Progresso do dia · 64,2708%$/);
    assert.deepEqual(day.lines, ['Faltam 08:34:30 para a meia-noite', 'São Paulo — Brasil']);
    assert.deepEqual(describeFace(now, 'pt', { hour12: true, placeName: 'São Paulo' }), {
      title: '03:25:30 PM',
      lines: ['Horário de São Paulo', 'America/Sao_Paulo · UTC−03:00'],
      accent: 'neutral',
    });
    assert.equal(toSpeech({ title: 'A', lines: ['B', 'C'] }), 'A. B. C');
  });
});

describe('tooltip content follows the selected zone (Tokyo)', () => {
  const tokyo = getZonedDateTime(instant, 'Asia/Tokyo'); // 03:25:30 on Friday, Oct 2nd

  test('the same instant is already the next day in Tokyo', () => {
    assert.deepEqual(describeDay(tokyo, 2, 'pt', 'Tóquio — Japão'), {
      title: '2 de outubro de 2026',
      lines: ['Sexta-feira · Hoje', 'Tóquio — Japão'],
      accent: 'day',
    });
    assert.equal(describeDay(tokyo, 1, 'pt').lines[0], 'Quinta-feira · Ontem');
    assert.deepEqual(describeYear(tokyo, 'pt').lines.slice(0, 2), ['275º dia do ano', '90 dias restantes']);
  });

  test('face, progress and week show Tokyo values and its offset', () => {
    assert.deepEqual(describeFace(tokyo, 'en', { placeName: 'Tokyo' }), {
      title: '03:25:30',
      lines: ['Tokyo time', 'Asia/Tokyo · UTC+09:00'],
      accent: 'neutral',
    });
    const day = describeProgress('day', tokyo, getTemporalProgress(tokyo), 'en', 'Tokyo — Japan');
    assert.equal(day.title, 'Day progress · 14.2708%');
    assert.deepEqual(day.lines, ['20:34:30 until midnight', 'Tokyo — Japan']);
    assert.deepEqual(describeWeekday(tokyo, 5, 'en').lines, ['October 2, 2026', 'Today']);
  });
});
