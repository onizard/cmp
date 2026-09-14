import { describe, it, expect } from 'vitest';
import {
  brainFill,
  pendingCount,
  pointsEarned,
  pointsSpent,
  pointsAvailable,
  canGift,
  gageProgress,
  gagesToHonour,
  BRAIN_CAP,
  GAGE_COST,
} from './gamify.js';

const task = (o = {}) => ({ deleted: false, done: false, doneBy: null, ...o });
const gage = (o = {}) => ({ deleted: false, fromUser: 'a', toUser: 'b', done: false, ...o });

describe('brainFill', () => {
  it('vide sans tâche', () => expect(brainFill([])).toBe(0));
  it('se remplit avec les tâches en attente', () =>
    expect(brainFill([task(), task(), task()], 6)).toBeCloseTo(0.5));
  it('plafonne à 1', () =>
    expect(brainFill(Array.from({ length: 30 }, () => task()))).toBe(1));
  it('ignore les tâches cochées et supprimées', () => {
    const list = [task({ done: true }), task({ deleted: true }), task()];
    expect(pendingCount(list)).toBe(1);
  });
});

describe('points par personne', () => {
  const tasks = [
    task({ done: true, doneBy: 'a' }),
    task({ done: true, doneBy: 'a' }),
    task({ done: true, doneBy: 'b' }),
    task({ done: false, doneBy: null }),
  ];
  it('compte les tâches cochées par la personne', () => {
    expect(pointsEarned(tasks, 'a')).toBe(2);
    expect(pointsEarned(tasks, 'b')).toBe(1);
  });
  it('dépense 10 points par gage offert', () => {
    expect(pointsSpent([gage({ fromUser: 'a' })], 'a')).toBe(GAGE_COST);
    expect(pointsSpent([gage({ fromUser: 'a' })], 'b')).toBe(0);
  });
  it('disponible = gagné - dépensé, jamais négatif', () => {
    const many = Array.from({ length: 12 }, () => task({ done: true, doneBy: 'a' }));
    expect(pointsAvailable(many, [gage({ fromUser: 'a' })], 'a')).toBe(2);
    expect(pointsAvailable([], [gage({ fromUser: 'a' })], 'a')).toBe(0);
  });
});

describe('gages', () => {
  it('canGift à partir de 10 points', () => {
    const ten = Array.from({ length: 10 }, () => task({ done: true, doneBy: 'a' }));
    expect(canGift(ten, [], 'a')).toBe(true);
    expect(canGift(ten.slice(0, 9), [], 'a')).toBe(false);
  });
  it('progression vers le prochain gage', () => {
    const seven = Array.from({ length: 7 }, () => task({ done: true, doneBy: 'a' }));
    expect(gageProgress(seven, [], 'a')).toEqual({ done: 7, total: 10, remaining: 3 });
  });
  it('liste les gages reçus non honorés', () => {
    const gages = [
      gage({ toUser: 'a', done: false }),
      gage({ toUser: 'a', done: true }),
      gage({ toUser: 'b', done: false }),
    ];
    expect(gagesToHonour(gages, 'a')).toHaveLength(1);
  });
});

describe('constantes', () => {
  it('valeurs par défaut', () => {
    expect(GAGE_COST).toBe(10);
    expect(BRAIN_CAP).toBeGreaterThan(0);
  });
});
