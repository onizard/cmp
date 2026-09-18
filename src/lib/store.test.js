import { describe, it, expect } from 'vitest';
import { decochable, estDefinitif } from './store.js';

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
