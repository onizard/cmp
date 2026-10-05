import { describe, it, expect } from 'vitest';
import {
  cleCategorie,
  extraireCategorie,
  hashtagEnCours,
  completerHashtag,
  statsCategories,
  suggerer,
  nomConnu,
  sectionsDuMois,
} from './categories.js';

const tache = (categorie, createdAt, extra = {}) => ({ id: Math.random(), categorie, createdAt, deleted: false, ...extra });

describe('hashtag à la fin', () => {
  it('sort la catégorie du texte', () => {
    expect(extraireCategorie('acheter du pain #dépense')).toEqual({ texte: 'acheter du pain', categorie: 'dépense' });
    expect(extraireCategorie('acheter du pain #dépense  ')).toEqual({ texte: 'acheter du pain', categorie: 'dépense' });
  });
  it('ignore un # qui n’est pas à la fin', () => {
    expect(extraireCategorie('appeler le #1 de la liste')).toEqual({ texte: 'appeler le #1 de la liste', categorie: null });
    expect(extraireCategorie('ticket#42')).toEqual({ texte: 'ticket#42', categorie: null });
  });
  it('un # seul ne fait pas de catégorie', () => {
    expect(extraireCategorie('pain #')).toEqual({ texte: 'pain #', categorie: null });
  });
  it('« #dons » seul : une catégorie, pas de texte', () => {
    expect(extraireCategorie('#dons')).toEqual({ texte: '', categorie: 'dons' });
  });
  it('repère le hashtag entamé et le complète', () => {
    expect(hashtagEnCours('pain #d')).toBe('d');
    expect(hashtagEnCours('pain #')).toBe('');
    expect(hashtagEnCours('pain #dép ')).toBe(null);
    expect(hashtagEnCours('pain')).toBe(null);
    expect(completerHashtag('acheter du pain #d', 'dépense')).toBe('acheter du pain #dépense ');
  });
});

describe('suggestions', () => {
  const stats = statsCategories(
    [
      tache('dépense', '2026-09-01T10:00:00Z'),
      tache('Dépense', '2026-09-03T10:00:00Z'),
      tache('dons', '2026-09-02T10:00:00Z'),
      tache('docs', '2026-09-05T10:00:00Z'),
      tache('docs', '2026-09-06T10:00:00Z', { deleted: true }),
      tache('maison', '2026-09-04T10:00:00Z'),
    ],
    [{ nom: 'Dons', mois: '2026-10', createdAt: '2026-09-04T12:00:00Z' }],
  );
  it('la plus fréquente d’abord', () => {
    // dépense ×2 et dons ×2 (une tâche + une création au bouton) : la plus récente gagne.
    expect(suggerer(stats, 'd')).toEqual(['Dons', 'Dépense', 'docs']);
  });
  it('à fréquence égale, la plus récente', () => {
    const s = statsCategories([tache('dons', '2026-09-01T00:00:00Z'), tache('dépense', '2026-09-02T00:00:00Z')]);
    expect(suggerer(s, 'd')).toEqual(['dépense', 'dons']);
  });
  it('filtre au fil de la frappe, sans accents ni casse', () => {
    expect(suggerer(stats, 'DEP')).toEqual(['Dépense']);
    expect(suggerer(stats, 'do')).toEqual(['Dons', 'docs']);
    expect(suggerer(stats, 'x')).toEqual([]);
    // « # » seul : toutes, la plus fréquente en tête.
    expect(suggerer(stats, '')).toEqual(['Dons', 'Dépense', 'docs', 'maison']);
  });
  it('ne propose pas ce qu’on exclut', () => {
    expect(suggerer(stats, 'd', { exclure: ['dons'] })).toEqual(['Dépense', 'docs']);
  });
  it('garde le nom déjà employé', () => {
    expect(nomConnu(stats, 'DEPENSE')).toBe('Dépense');
    expect(nomConnu(stats, ' #nouveau ')).toBe('nouveau');
    expect(cleCategorie(' Dépense ')).toBe('depense');
  });
});

describe('sections du mois', () => {
  it('range les tâches et garde les catégories vides du mois', () => {
    const a = tache(null, 'x'), b = tache('dépense', 'x'), c = tache('Dépense', 'x'), d = tache('auto', 'x');
    const { sans, sections } = sectionsDuMois(
      [a, b, c, d],
      [{ id: 'l1', nom: 'dons', mois: '2026-10' }, { id: 'l2', nom: 'ancienne', mois: '2026-09' }],
      '2026-10',
    );
    expect(sans).toEqual([a]);
    expect(sections.map((s) => [s.nom, s.taches.length, Boolean(s.ligne)])).toEqual([
      ['auto', 1, false],
      ['dépense', 2, false],
      ['dons', 0, true],
    ]);
  });
});
