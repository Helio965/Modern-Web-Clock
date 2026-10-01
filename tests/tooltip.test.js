import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getSaoPauloDateTime, getTemporalProgress } from '../js/sao-paulo-time.js';
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
const now = getSaoPauloDateTime(Date.parse('2026-10-01T18:25:30Z'));

describe('tooltip content (São Paulo date)', () => {
  test('current day', () => {
    assert.deepEqual(describeDay(now, 1, 'pt'), {
      title: '1 de outubro de 2026',
      lines: ['Quinta-feira · Hoje', 'São Paulo — Brasil'],
      accent: 'day',
    });
    assert.deepEqual(describeDay(now, 1, 'en').lines, ['Thursday · Today', 'São Paulo — Brazil']);
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
    const day = describeProgress('day', now, progress, 'pt');
    assert.match(day.title, /^Progresso do dia · 64,2708%$/);
    assert.deepEqual(day.lines, ['Faltam 08:34:30 para a meia-noite', 'São Paulo — Brasil']);
    assert.deepEqual(describeFace(now, 'pt', { hour12: true }).title, '03:25:30 PM');
    assert.equal(toSpeech({ title: 'A', lines: ['B', 'C'] }), 'A. B. C');
  });
});
