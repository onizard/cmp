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

// Un localStorage dont on peut lister les clés, comme celui du navigateur.
const stockage = () => {
  const m = new Map();
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  return new Proxy(ls, { ownKeys: () => [...m.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
};

const PERSO = '11111111-1111-1111-1111-111111111111';
const PRO = '22222222-2222-2222-2222-222222222222';
const MAISON = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ATELIER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('données effacées de l’appareil', () => {
  beforeEach(() => {
    globalThis.localStorage = stockage();
    memoriser({ session: session(PERSO, 'r1'), type: 'perso', hid: MAISON });
    memoriser({ session: session(PRO, 'r2'), type: 'pro', hid: ATELIER });
    for (const k of [`cmp:tasks:${MAISON}`, `cmp:queue:${MAISON}`, `cmp:categories:${MAISON}`, `cmp:rewards:${MAISON}`, `cmp:tasks:${ATELIER}`]) {
      localStorage.setItem(k, '[]');
    }
    localStorage.setItem('cmp.household', MAISON);
    localStorage.setItem('cmp.langue', 'fr');
  });

  it('retirer un compte efface aussi ses tâches et le reste', () => {
    oublier(PERSO);
    const cles = Object.keys(localStorage);
    expect(cles.filter((k) => k.includes(MAISON))).toEqual([]);
    expect(cles).not.toContain('cmp.household');
    expect(cles).toContain(`cmp:tasks:${ATELIER}`);
    expect(cles).toContain('cmp.langue');
  });

  it('ordinateur partagé : seul le pro reste, avec ses données', async () => {
    const { activerPostePartage, desactiverPostePartage, postePartage } = await import('./comptes.js');
    activerPostePartage({ userId: PRO, email: 'pro@ex.fr', hid: ATELIER });
    expect(postePartage()).toEqual({ userId: PRO, email: 'pro@ex.fr' });
    expect(lireComptes().map((c) => c.userId)).toEqual([PRO]);
    const cles = Object.keys(localStorage);
    expect(cles.filter((k) => k.includes(MAISON))).toEqual([]);
    expect(cles).toContain(`cmp:tasks:${ATELIER}`);
    // Un autre compte ne s'y range plus.
    memoriser({ session: session(PERSO, 'r9'), type: 'perso', hid: MAISON });
    expect(lireComptes().map((c) => c.userId)).toEqual([PRO]);
    expect(plusieursComptes()).toBe(false);
    desactiverPostePartage();
    expect(postePartage()).toBe(null);
  });
});
