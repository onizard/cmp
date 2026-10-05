import { describe, it, expect } from 'vitest';
import { rangsAuDepot, PAS } from './ordre.js';
import { sortForMonth } from './visibility.js';

const t = (id, rang = null, extra = {}) => ({ id, rang, done: false, createdAt: `2026-10-0${id.length}T00:00:00Z`, text: id, ...extra });

describe('rang au dépôt', () => {
  it('premier déplacement : toute la section est numérotée', () => {
    const a = t('a'), b = t('b'), c = t('c');
    expect(rangsAuDepot([a, b, c], 1, c)).toEqual([
      { id: 'a', rang: PAS },
      { id: 'c', rang: 2 * PAS },
      { id: 'b', rang: 3 * PAS },
    ]);
  });
  it('entre deux voisines rangées : une seule écriture, au milieu', () => {
    const a = t('a', 1000), b = t('b', 2000), c = t('c', 3000);
    expect(rangsAuDepot([a, b, c], 1, c)).toEqual([{ id: 'c', rang: 1500 }]);
  });
  it('en tête ou en queue', () => {
    const a = t('a', 1000), b = t('b', 2000), c = t('c', 3000);
    expect(rangsAuDepot([a, b, c], 0, c)).toEqual([{ id: 'c', rang: 0 }]);
    expect(rangsAuDepot([a, b, c], 2, a)).toEqual([{ id: 'a', rang: 4000 }]);
  });
  it('dans une section vide', () => {
    expect(rangsAuDepot([], 0, t('x'))).toEqual([{ id: 'x', rang: PAS }]);
  });
  it('plus de place entre deux rangs : on renumérote', () => {
    const a = t('a', 1), b = t('b', 1 + Number.EPSILON), c = t('c', 5);
    const r = rangsAuDepot([a, b, c], 1, c);
    expect(r.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('tri du mois', () => {
  it('les tâches déplacées gardent leur ordre, devant les autres', () => {
    const echeance = t('e', null, { dueAt: '2026-10-02T00:00:00Z' });
    const liste = sortForMonth([t('x'), t('b', 2000), echeance, t('a', 1000), t('fait', 1, { done: true })]);
    expect(liste.map((x) => x.id)).toEqual(['a', 'b', 'e', 'x', 'fait']);
  });
});
