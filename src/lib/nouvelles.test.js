import { describe, it, expect, beforeEach } from 'vitest';
import { lireVus, nouvellesCoches, marquerVue } from './nouvelles.js';

const MOI = 'moi';
const ELLE = 'elle';
const NOW = Date.parse('2026-09-29T08:00:00Z');
const il = (h) => new Date(NOW - h * 3600_000).toISOString();
const coche = (id, h, par = ELLE, extra = {}) => ({ id, done: true, doneBy: par, doneAt: il(h), ...extra });

// Un stockage en mémoire, comme celui du navigateur.
beforeEach(() => {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
});

describe('nouvelles', () => {
  it('au premier passage, remonte d’un jour seulement', () => {
    const etat = lireVus(MOI, NOW);
    const r = nouvellesCoches([coche('a', 2), coche('b', 30)], MOI, etat);
    expect(r.map((t) => t.id)).toEqual(['a']);
  });

  it('ne garde que les coches de l’autre, encore cochées, non supprimées', () => {
    const etat = lireVus(MOI, NOW);
    const tasks = [
      coche('a', 3),
      coche('b', 2, MOI),
      { ...coche('c', 2), done: false },
      coche('d', 1, ELLE, { deleted: true }),
      coche('e', 1, null),
    ];
    expect(nouvellesCoches(tasks, MOI, etat).map((t) => t.id)).toEqual(['a']);
  });

  it('de la plus ancienne à la plus récente, et une vue ne revient pas', () => {
    let etat = lireVus(MOI, NOW);
    const tasks = [coche('récente', 1), coche('ancienne', 5)];
    const r = nouvellesCoches(tasks, MOI, etat);
    expect(r.map((t) => t.id)).toEqual(['ancienne', 'récente']);
    etat = marquerVue(MOI, etat, r[0]);
    expect(nouvellesCoches(tasks, MOI, lireVus(MOI, NOW)).map((t) => t.id)).toEqual(['récente']);
  });

  it('une coche hors ligne arrivée en retard est tout de même montrée', () => {
    let etat = lireVus(MOI, NOW);
    etat = marquerVue(MOI, etat, coche('récente', 1));
    const tasks = [coche('récente', 1), coche('hors-ligne', 4)];
    expect(nouvellesCoches(tasks, MOI, etat).map((t) => t.id)).toEqual(['hors-ligne']);
  });

  it('oublier les plus anciennes ne les fait pas revenir', () => {
    let etat = lireVus(MOI, NOW);
    const tasks = Array.from({ length: 305 }, (_, i) => coche(`t${i}`, 20 - i * 0.05));
    for (const t of tasks) etat = marquerVue(MOI, etat, t);
    expect(etat.vus.length).toBe(300);
    expect(nouvellesCoches(tasks, MOI, etat)).toEqual([]);
  });

  it('stockage illisible : on repart proprement', () => {
    localStorage.setItem(`cmp.nouvelles.${MOI}`, '{pas du json');
    const etat = lireVus(MOI, NOW);
    expect(etat.vus).toEqual([]);
  });
});
