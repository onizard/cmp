import { describe, it, expect } from 'vitest';
import { avecSessions, personnes, entree, estTacheEnfants } from './session.js';

const proches = [
  { id: 'lina', nom: 'Lina', actif: true },
  { id: 'ancien', nom: 'Ancien', actif: false },
];

describe('sessions', () => {
  it('ne s’ouvrent que sur un téléphone partagé', () => {
    expect(avecSessions({ proches: [] })).toBe(false);
    expect(avecSessions({ proches: [{ id: 'x', actif: false }] })).toBe(false);
    expect(avecSessions({ proches })).toBe(true);
    expect(avecSessions({ entreprise: true })).toBe(true);
  });

  it('listent le téléphone, les autres adultes, puis les enfants actifs', () => {
    const l = personnes({ userId: 'o', members: ['v', 'o'], names: { o: 'Olivier', v: 'Vanessa' }, proches });
    expect(l.map((p) => p.nom)).toEqual(['Olivier', 'Vanessa', 'Lina']);
    expect(l[1]).toMatchObject({ compte: 'v', proche: null, enfant: false });
    expect(l[2]).toMatchObject({ compte: 'o', proche: 'lina', enfant: true });
  });

  it('demandent le code de qui en a un, refusent un autre adulte sans code', () => {
    const [moi, vanessa, lina] = personnes({ userId: 'o', members: ['o', 'v'], proches });
    expect(entree(moi, 'o', [])).toBe('direct');
    expect(entree(moi, 'o', ['o'])).toBe('code');
    expect(entree(vanessa, 'o', [])).toBe('sansCode');
    expect(entree(vanessa, 'o', ['v'])).toBe('code');
    expect(entree(lina, 'o', [])).toBe('direct');
    expect(entree(lina, 'o', ['lina'])).toBe('code');
  });

  it('reconnaissent les tâches des enfants, dans toutes les langues', () => {
    expect(estTacheEnfants({ categorie: 'Enfants' })).toBe(true);
    expect(estTacheEnfants({ categorie: 'kids' })).toBe(true);
    expect(estTacheEnfants({ categorie: 'niños' })).toBe(true);
    expect(estTacheEnfants({ categorie: 'courses' })).toBe(false);
    expect(estTacheEnfants({ categorie: null })).toBe(false);
  });
});

describe('catégorie des enfants', () => {
  it('reprend le nom déjà employé par le foyer, sinon celui de la langue', async () => {
    const { nomEnfants } = await import('./session.js');
    const { statsCategories } = await import('./categories.js');
    const stats = statsCategories([{ categorie: 'Enfants', createdAt: '2026-10-01' }, { categorie: 'courses' }]);
    expect(nomEnfants(stats, 'kids')).toBe('Enfants');
    expect(nomEnfants(statsCategories([]), 'kids')).toBe('kids');
  });
});
