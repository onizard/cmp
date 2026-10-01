import { describe, it, expect } from 'vitest';
import { estFamille, classement } from './famille.js';
import { bonsAHonorer } from './gamify.js';

const fait = (id, par) => ({ id, deleted: false, done: true, doneBy: par, createdBy: par });

describe('mode famille', () => {
  it('s’allume à 3 membres', () => {
    expect(estFamille(['a', 'b'])).toBe(false);
    expect(estFamille(['a', 'b', 'c'])).toBe(true);
    expect(estFamille(undefined)).toBe(false);
  });

  it('classe par points disponibles, ex aequo au même rang', () => {
    // Ajouter + cocher sa tâche : 2 points chacune.
    const tasks = [fait('1', 'a'), fait('2', 'b'), fait('3', 'b'), fait('4', 'c')];
    const r = classement(['a', 'b', 'c'], tasks, [], { a: 'Olivier', b: 'Vanessa', c: 'Norah' });
    expect(r.map((l) => [l.nom, l.points, l.rang])).toEqual([
      ['Vanessa', 4, 1],
      ['Norah', 2, 2],
      ['Olivier', 2, 2],
    ]);
  });

  it('les points dépensés sont retirés', () => {
    const tasks = [fait('1', 'a'), fait('2', 'a')];
    const claims = [{ userId: 'a', cost: 3, deleted: false }];
    expect(classement(['a'], tasks, claims)[0].points).toBe(1);
  });
});

describe('bons à honorer en famille', () => {
  const bon = (id, userId, pour) => ({ id, userId, pour, deleted: false, usedAt: '2026-10-01T10:00:00Z', realiseAt: null });
  it('un bon désigné ne s’affiche que chez la personne choisie', () => {
    const claims = [bon('x', 'a', 'c')];
    expect(bonsAHonorer(claims, 'c').map((b) => b.id)).toEqual(['x']);
    expect(bonsAHonorer(claims, 'b')).toEqual([]);
    expect(bonsAHonorer(claims, 'a')).toEqual([]);
  });
  it('sans destinataire, chez tous sauf le détenteur', () => {
    const claims = [bon('y', 'a', null)];
    expect(bonsAHonorer(claims, 'b').map((b) => b.id)).toEqual(['y']);
    expect(bonsAHonorer(claims, 'c').map((b) => b.id)).toEqual(['y']);
    expect(bonsAHonorer(claims, 'a')).toEqual([]);
  });
});
