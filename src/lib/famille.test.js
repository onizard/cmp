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

  it('s’active aussi à deux, si le foyer le choisit', () => {
    expect(estFamille(['a', 'b'], true)).toBe(true);
    expect(estFamille(['a', 'b', 'c'], false)).toBe(true);
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

describe('membres sans compte', () => {
  it('une tâche cochée par Lina lui rapporte, pas au téléphone de papa', async () => {
    const { creditees, bonsCredites, tousLesMembres, tousLesNoms, classement } = await import('./famille.js');
    const tasks = [
      { id: '1', createdBy: 'papa', done: true, doneBy: 'papa', doneProche: 'lina', doneAt: '2026-10-01T10:00:00Z' },
      { id: '2', createdBy: 'papa', done: true, doneBy: 'papa', doneAt: '2026-10-01T11:00:00Z' },
    ];
    const claims = [{ id: 'c', userId: 'papa', proche: 'lina', cost: 1 }];
    const proches = [{ id: 'lina', nom: 'Lina', actif: true }, { id: 'tom', nom: 'Tom', actif: false }];
    const membres = tousLesMembres(['papa', 'maman'], proches);
    expect(membres).toEqual(['papa', 'maman', 'lina']);
    const r = classement(membres, creditees(tasks), bonsCredites(claims), tousLesNoms({ papa: 'Papa', maman: 'Maman' }, proches));
    const pts = Object.fromEntries(r.map((l) => [l.nom, l.points]));
    // Papa : 2 ajouts + sa propre coche ; Lina : la tâche de papa (1,5) moins son bon (1).
    expect(pts).toEqual({ Papa: 3, Lina: 0.5, Maman: 0 });
  });
});
