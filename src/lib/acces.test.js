import { describe, it, expect, beforeEach } from 'vitest';
import { formaterCode, codeComplet, lireDecision, lireDemande } from './acces.js';

beforeEach(() => {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
});

describe('rejoindre un compte pro', () => {
  it('le code de liaison se met en forme au fil de la frappe', () => {
    expect(formaterCode('k7q')).toBe('K7Q');
    expect(formaterCode('k7qm4')).toBe('K7QM-4');
    expect(formaterCode(' k7qm 4xpr ')).toBe('K7QM-4XPR');
    expect(formaterCode('K7QM-4XPR-ZZ')).toBe('K7QM-4XPR');
    expect(codeComplet('k7qm4xp')).toBe(false);
    expect(codeComplet('k7qm4xpr')).toBe(true);
  });

  it('lit le lien du mail de l’administrateur', () => {
    expect(lireDecision('?acces=abc&cle=123&r=non')).toEqual({ id: 'abc', cle: '123', r: 'non' });
    expect(lireDecision('?acces=abc&cle=123')).toEqual({ id: 'abc', cle: '123', r: 'oui' });
    expect(lireDecision('?acces=abc')).toBe(null);
    expect(lireDecision('?foyer=xyz')).toBe(null);
  });

  it('la demande en attente n’appartient qu’au compte qui l’a faite', () => {
    localStorage.setItem('cmp.acces', JSON.stringify({ id: 'd1', code: 'K7QM-4XPR', demandeur: 'perso' }));
    expect(lireDemande('perso')?.id).toBe('d1');
    expect(lireDemande('pro')).toBe(null);
  });
});
