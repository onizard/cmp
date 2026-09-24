import { describe, it, expect } from 'vitest';
import { bilan, graduations } from './bilan.js';
import { POINT_ADD, POINT_OWN, POINT_OTHER } from './gamify.js';

const MOI = 'moi';
const ELLE = 'elle';
const T = (id, extra) => ({ id, deleted: false, done: false, createdBy: MOI, createdAt: '2026-09-10T10:00:00Z', ...extra });

describe('bilan', () => {
  it('cumule les points gagnés, même dépensés', () => {
    const tasks = [T('a', { done: true, doneBy: MOI, doneMonth: '2026-09' })];
    const claims = [{ userId: MOI, cost: 1, deleted: false }];
    const b = bilan(tasks, claims, MOI, '2026-09');
    expect(b.cumules).toBe(POINT_ADD + POINT_OWN);
    expect(b.depenses).toBe(1);
    expect(b.disponibles).toBe(POINT_ADD + POINT_OWN - 1);
  });

  it('ne compte que les miennes', () => {
    const tasks = [
      T('a', { createdBy: ELLE, done: true, doneBy: ELLE, doneMonth: '2026-09' }),
      T('b', { createdBy: ELLE, done: true, doneBy: MOI, doneMonth: '2026-09' }),
    ];
    const b = bilan(tasks, [], MOI, '2026-09');
    expect(b.creees).toBe(0);
    expect(b.realisees).toBe(1);
    expect(b.cumules).toBe(POINT_OTHER);
  });

  it('range une tâche réalisée au mois de sa coche, créée au mois de son ajout', () => {
    const tasks = [T('a', { createdAt: '2026-07-20T10:00:00Z', done: true, doneBy: MOI, doneMonth: '2026-09' })];
    const b = bilan(tasks, [], MOI, '2026-09');
    expect(b.mois).toEqual([
      { mois: '2026-07', realisees: 0, creees: 1 },
      { mois: '2026-08', realisees: 0, creees: 0 },
      { mois: '2026-09', realisees: 1, creees: 0 },
    ]);
  });

  it('ignore les tâches supprimées, comme les points', () => {
    const b = bilan([T('a', { deleted: true })], [], MOI, '2026-09');
    expect(b.creees).toBe(0);
    expect(b.cumules).toBe(0);
  });

  it('montre six mois au plus', () => {
    const tasks = [T('vieux', { createdAt: '2025-01-05T10:00:00Z' })];
    const b = bilan(tasks, [], MOI, '2026-09');
    expect(b.mois.map((m) => m.mois)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    // Le total, lui, reste celui de toujours.
    expect(b.creees).toBe(1);
  });

  it('montre au moins le mois en cours pour un compte tout neuf', () => {
    expect(bilan([], [], MOI, '2026-09').mois).toEqual([{ mois: '2026-09', realisees: 0, creees: 0 }]);
  });
});

describe('graduations', () => {
  it('donne des pas ronds', () => {
    expect(graduations(7)).toEqual([0, 2, 4, 6, 8]);
    expect(graduations(23)).toEqual([0, 10, 20, 30]);
    expect(graduations(3)).toEqual([0, 1, 2, 3]);
  });
  it('tient sans données', () => {
    expect(graduations(0)).toEqual([0, 1]);
  });
});
