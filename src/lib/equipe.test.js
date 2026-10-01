import { describe, it, expect } from 'vitest';
import { codeOperateurValide, codeResponsableValide, tachesParOperateur } from './equipe.js';
import { classement } from './famille.js';

describe('mode entreprise', () => {
  it('un code opérateur fait exactement 4 chiffres', () => {
    expect(codeOperateurValide('1234')).toBe(true);
    expect(codeOperateurValide('123')).toBe(false);
    expect(codeOperateurValide('12345')).toBe(false);
    expect(codeOperateurValide('12a4')).toBe(false);
    expect(codeOperateurValide(null)).toBe(false);
  });

  it('un code responsable fait 4 à 8 chiffres', () => {
    expect(codeResponsableValide('2468')).toBe(true);
    expect(codeResponsableValide('24681357')).toBe(true);
    expect(codeResponsableValide('246813579')).toBe(false);
  });

  it('les points se comptent par opérateur, pas par compte', () => {
    // Tout est fait depuis le même compte « tablette » : seul l'opérateur compte.
    const t = (id, createdOp, doneOp) => ({ id, deleted: false, createdBy: 'tablette', createdOp, done: Boolean(doneOp), doneBy: doneOp ? 'tablette' : null, doneOp });
    const tasks = tachesParOperateur([t('1', 'julie', 'marc'), t('2', 'julie', null), t('3', 'marc', 'marc')]);
    const r = classement(['julie', 'marc'], tasks, [], { julie: 'Julie', marc: 'Marc' });
    // Marc : 1 ajout + 1 coche de sa tâche + 1,5 pour celle de Julie = 3,5. Julie : 2 ajouts.
    expect(r.map((l) => [l.nom, l.points])).toEqual([['Marc', 3.5], ['Julie', 2]]);
  });
});
