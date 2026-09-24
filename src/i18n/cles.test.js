import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUES } from './index.js';

// Toutes les clés écrites en dur dans le code : t('section.cle').
// Une clé absente ne plante rien — t() la renvoie telle quelle, et l'écran
// affiche « recompenses.prendre » sur un bouton. C'est arrivé : ce test est là
// pour que ça ne se reproduise pas en silence.
const fichiers = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'i18n' ? [] : fichiers(p);
    return /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

const cles = new Set();
for (const f of fichiers('src')) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z]+\.[a-zA-Z.]+)'/g)) cles.add(m[1]);
}

const trouver = (dict, cle) =>
  cle.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);

describe('dictionnaires', () => {
  it('le code utilise bien des clés', () => {
    expect(cles.size).toBeGreaterThan(100);
  });

  for (const { code, dict } of LANGUES) {
    it(`${code} connaît toutes les clés du code`, () => {
      const manquantes = [...cles].filter((c) => trouver(dict, c) === undefined);
      expect(manquantes).toEqual([]);
    });
  }
});
