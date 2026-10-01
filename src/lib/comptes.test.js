import { describe, it, expect, beforeEach } from 'vitest';
import { lireComptes, memoriser, oublier, plusieursComptes } from './comptes.js';

const session = (id, refresh, email = `${id}@ex.fr`) => ({
  user: { id, email }, access_token: `a-${refresh}`, refresh_token: refresh,
});

beforeEach(() => {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
});

describe('comptes rangés', () => {
  it('range perso et pro, sans jamais de mot de passe', () => {
    memoriser({ session: session('perso', 'r1'), nom: 'Maison', type: 'perso' });
    memoriser({ session: session('pro', 'r2'), nom: 'Atelier', type: 'pro' });
    const l = lireComptes();
    expect(l.map((c) => [c.userId, c.type, c.nom])).toEqual([['perso', 'perso', 'Maison'], ['pro', 'pro', 'Atelier']]);
    expect(JSON.stringify(l)).not.toMatch(/password|motDePasse|mdp/i);
  });

  it('les jetons qui tournent mettent à jour le compte, sans perdre son espace', () => {
    memoriser({ session: session('pro', 'r2'), nom: 'Atelier', type: 'pro' });
    memoriser({ session: session('pro', 'r3') });
    const [c] = lireComptes();
    expect(c.refresh).toBe('r3');
    expect(c.nom).toBe('Atelier');
    expect(c.type).toBe('pro');
  });

  it('un seul compte : pas de page de choix ; perso et pro : la page de choix', () => {
    memoriser({ session: session('perso', 'r1'), type: 'perso' });
    expect(plusieursComptes()).toBe(false);
    memoriser({ session: session('pro', 'r2'), type: 'pro' });
    expect(plusieursComptes()).toBe(true);
    oublier('pro');
    expect(plusieursComptes()).toBe(false);
  });

  it('oublier retire un seul compte', () => {
    memoriser({ session: session('perso', 'r1') });
    memoriser({ session: session('pro', 'r2') });
    oublier('perso');
    expect(lireComptes().map((c) => c.userId)).toEqual(['pro']);
  });

  it('une liste abîmée ne casse rien', () => {
    localStorage.setItem('cmp.comptes', '{pas du json');
    expect(lireComptes()).toEqual([]);
  });
});
