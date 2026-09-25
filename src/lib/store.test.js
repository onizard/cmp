import { describe, it, expect } from 'vitest';
import { decochable, estDefinitif, modifiable, memeTexte, doublonAFaire } from './store.js';

const MOI = 'aaaaaaaa-0000-0000-0000-000000000001';
const AUTRE = 'bbbbbbbb-0000-0000-0000-000000000002';

describe('decochable', () => {
  it('laisse cocher une tâche à faire', () => {
    expect(decochable({ done: false, doneBy: null }, MOI)).toBe(true);
  });

  it('laisse décocher ce que j’ai coché', () => {
    expect(decochable({ done: true, doneBy: MOI }, MOI)).toBe(true);
  });

  it('refuse de décocher ce que l’autre a coché', () => {
    expect(decochable({ done: true, doneBy: AUTRE }, MOI)).toBe(false);
  });

  it('laisse décocher une tâche sans auteur enregistré', () => {
    // Sinon elle resterait cochée pour toujours.
    expect(decochable({ done: true, doneBy: null }, MOI)).toBe(true);
  });

  it('refuse quand on ne sait pas qui est le lecteur', () => {
    expect(decochable({ done: true, doneBy: AUTRE }, undefined)).toBe(false);
  });
});

describe('estDefinitif', () => {
  it('reconnaît le refus de décoche du serveur', () => {
    expect(estDefinitif({ code: '42501' })).toBe(true);
  });

  it('garde une panne réseau pour plus tard', () => {
    expect(estDefinitif(new TypeError('Failed to fetch'))).toBe(false);
    expect(estDefinitif({ code: '503' })).toBe(false);
    expect(estDefinitif(undefined)).toBe(false);
  });
});

describe('modifiable', () => {
  it('laisse l’auteur modifier sa tâche', () => {
    expect(modifiable({ createdBy: MOI }, MOI)).toBe(true);
  });

  it('refuse de modifier la tâche que l’autre a ajoutée', () => {
    expect(modifiable({ createdBy: AUTRE }, MOI)).toBe(false);
  });

  it('laisse modifier une tâche sans auteur enregistré', () => {
    // Sinon elle resterait figée pour toujours.
    expect(modifiable({ createdBy: null }, MOI)).toBe(true);
  });

  it('refuse quand on ne sait pas qui regarde', () => {
    expect(modifiable({ createdBy: AUTRE }, undefined)).toBe(false);
  });
});

describe('doublons', () => {
  const T = (id, text, extra = {}) => ({ id, text, month: '2026-09', done: false, deleted: false, ...extra });

  it('reconnaît le même texte malgré casse, accents et espaces', () => {
    expect(memeTexte('Déboucher  le siphon ', 'deboucher le SIPHON')).toBe(true);
    expect(memeTexte('Déboucher le siphon', 'Déboucher la douche')).toBe(false);
    expect(memeTexte('', '')).toBe(false);
  });

  it('trouve la tâche identique encore à faire', () => {
    const tasks = [T('a', 'Déboucher le siphon de la douche')];
    expect(doublonAFaire(tasks, '2026-09', 'déboucher le siphon de la douche')?.id).toBe('a');
  });

  it('laisse recréer une tâche déjà faite', () => {
    // Les courses de la semaine prochaine ne sont pas un doublon de celles d'hier.
    const tasks = [T('a', 'Courses', { done: true })];
    expect(doublonAFaire(tasks, '2026-09', 'Courses')).toBe(null);
  });

  it('voit les tâches reportées des mois passés, pas celles des mois à venir', () => {
    expect(doublonAFaire([T('a', 'Courses', { month: '2026-08' })], '2026-09', 'Courses')?.id).toBe('a');
    expect(doublonAFaire([T('a', 'Courses', { month: '2026-10' })], '2026-09', 'Courses')).toBe(null);
  });

  it('ignore une tâche supprimée', () => {
    expect(doublonAFaire([T('a', 'Courses', { deleted: true })], '2026-09', 'Courses')).toBe(null);
  });
});
