import { describe, it, expect } from 'vitest';
import {
  brainFill,
  pendingCount,
  pointsBreakdown,
  pointsEarned,
  pointsSpent,
  pointsAvailable,
  sortRewards,
  affordable,
  nextReward,
  formatPoints,
  POINT_ADD,
  POINT_OWN,
  POINT_OTHER,
} from './gamify.js';

const task = (o = {}) => ({
  deleted: false,
  done: false,
  doneBy: null,
  createdBy: null,
  ...o,
});
const claim = (o = {}) => ({ deleted: false, userId: 'a', cost: 10, ...o });
const reward = (label, cost) => ({ id: label, label, cost, deleted: false });

describe('cerveau du foyer', () => {
  it('vide sans tâche', () => expect(brainFill([])).toBe(0));
  it('se remplit avec les tâches en attente', () =>
    expect(brainFill([task(), task(), task()], 6)).toBeCloseTo(0.5));
  it('plafonne à 1', () =>
    expect(brainFill(Array.from({ length: 30 }, () => task()))).toBe(1));
  it('ignore les tâches cochées et supprimées', () =>
    expect(
      pendingCount([task({ done: true }), task({ deleted: true }), task()]),
    ).toBe(1));
});

describe('barème', () => {
  it('1 point pour avoir ajouté une tâche', () => {
    expect(pointsEarned([task({ createdBy: 'a' })], 'a')).toBe(POINT_ADD);
  });

  it('1 point de plus si on coche sa propre tâche', () => {
    const t = task({ createdBy: 'a', done: true, doneBy: 'a' });
    expect(pointsEarned([t], 'a')).toBe(POINT_ADD + POINT_OWN);
  });

  it('1,5 point si on coche la tâche de l’autre', () => {
    const t = task({ createdBy: 'b', done: true, doneBy: 'a' });
    expect(pointsEarned([t], 'a')).toBe(POINT_OTHER);
    // et l'autre garde son point d'ajout
    expect(pointsEarned([t], 'b')).toBe(POINT_ADD);
  });

  it('détaille les trois sources', () => {
    const tasks = [
      task({ createdBy: 'a' }),
      task({ createdBy: 'a', done: true, doneBy: 'a' }),
      task({ createdBy: 'b', done: true, doneBy: 'a' }),
    ];
    expect(pointsBreakdown(tasks, 'a')).toEqual({
      added: 2,
      own: 1,
      other: 1,
      total: 2 + 1 + 1.5,
    });
  });

  it('ignore les tâches supprimées', () => {
    const t = task({ createdBy: 'a', done: true, doneBy: 'a', deleted: true });
    expect(pointsEarned([t], 'a')).toBe(0);
  });

  it('compte au taux simple si l’auteur est inconnu', () => {
    const t = task({ createdBy: null, done: true, doneBy: 'a' });
    expect(pointsEarned([t], 'a')).toBe(POINT_OWN);
  });
});

describe('dépenses', () => {
  it('additionne le coût des récompenses prises', () => {
    expect(pointsSpent([claim({ cost: 10 }), claim({ cost: 2.5 })], 'a')).toBe(12.5);
  });
  it('ne compte que les siennes', () => {
    expect(pointsSpent([claim({ userId: 'b', cost: 10 })], 'a')).toBe(0);
  });
  it('disponible = gagné − dépensé, jamais négatif', () => {
    const tasks = [task({ createdBy: 'a', done: true, doneBy: 'a' })]; // 2 pts
    expect(pointsAvailable(tasks, [], 'a')).toBe(2);
    expect(pointsAvailable(tasks, [claim({ cost: 10 })], 'a')).toBe(0);
  });
});

describe('récompenses', () => {
  const list = [reward('grosse', 30), reward('petite', 5), reward('moyenne', 15)];

  it('classées du moins cher au plus cher', () => {
    expect(sortRewards(list).map((r) => r.label)).toEqual([
      'petite',
      'moyenne',
      'grosse',
    ]);
  });

  it('celles qu’on peut s’offrir', () => {
    expect(affordable(list, 15).map((r) => r.label)).toEqual(['petite', 'moyenne']);
    expect(affordable(list, 2)).toHaveLength(0);
  });

  it('indique ce qu’il manque pour la suivante', () => {
    expect(nextReward(list, 5)).toEqual({ reward: list[2], missing: 10 });
  });

  it('rien à viser quand tout est accessible', () => {
    expect(nextReward(list, 100)).toBeNull();
  });

  it('écrit les demi-points à la française', () => {
    expect(formatPoints(12.5)).toBe('12,5');
    expect(formatPoints(12)).toBe('12');
  });
});
