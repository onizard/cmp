import { describe, it, expect } from 'vitest';
import { comboParTache, comboDe, comboProchain, jourLocal } from './combo.js';
import { pointsBreakdown, POINT_OWN, POINT_OTHER, POINT_ADD, COMBO_BONUS } from './gamify.js';

const MOI = 'a';
const AUTRE = 'b';

// Un instant du jour donné, à l'heure locale : c'est la journée du téléphone
// qui compte, pas celle du serveur.
const le = (jour, h = 12, min = 0) =>
  new Date(`${jour}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`).toISOString();

const fait = (id, jour, h, extra = {}) => ({
  id,
  deleted: false,
  done: true,
  doneBy: MOI,
  doneAt: le(jour, h),
  createdBy: MOI,
  ...extra,
});

describe('jourLocal', () => {
  it('rend le jour du téléphone', () => {
    expect(jourLocal(le('2026-09-20', 23))).toBe('2026-09-20');
  });

  it('ne se noie pas sur une valeur absente ou illisible', () => {
    expect(jourLocal(null)).toBe(null);
    expect(jourLocal('pas une date')).toBe(null);
  });
});

describe('comboParTache', () => {
  it('donne son rang du jour à chaque tâche', () => {
    const tasks = [fait('1', '2026-09-20', 8), fait('2', '2026-09-20', 9), fait('3', '2026-09-20', 18)];
    const rangs = comboParTache(tasks, MOI);
    expect([rangs.get('1'), rangs.get('2'), rangs.get('3')]).toEqual([1, 2, 3]);
  });

  it('classe par l’heure, pas par l’ordre de la liste', () => {
    const tasks = [fait('tard', '2026-09-20', 20), fait('tot', '2026-09-20', 7)];
    expect(comboDe(tasks, MOI, 'tot')).toBe(1);
    expect(comboDe(tasks, MOI, 'tard')).toBe(2);
  });

  it('repart de un le lendemain', () => {
    const tasks = [fait('1', '2026-09-20', 9), fait('2', '2026-09-21', 9)];
    expect(comboDe(tasks, MOI, '2')).toBe(1);
  });

  it('compte chacun pour soi', () => {
    const tasks = [
      fait('1', '2026-09-20', 8, { doneBy: AUTRE }),
      fait('2', '2026-09-20', 9),
    ];
    // La tâche de l'autre ne pousse pas la mienne au rang deux.
    expect(comboDe(tasks, MOI, '2')).toBe(1);
  });

  it('ignore les tâches supprimées et celles qu’on n’a pas cochées', () => {
    const tasks = [
      fait('1', '2026-09-20', 7, { deleted: true }),
      { id: '2', done: false, doneBy: null, doneAt: null, deleted: false },
      fait('3', '2026-09-20', 9),
    ];
    expect(comboDe(tasks, MOI, '3')).toBe(1);
  });

  it('laisse à un les coches d’avant la colonne', () => {
    // Pas d'instant enregistré : la tâche ne compte ni pour elle-même ni
    // pour le rang des autres, plutôt que de distribuer des combos au hasard.
    const tasks = [
      { id: 'vieille', done: true, doneBy: MOI, doneAt: null, deleted: false },
      fait('2', '2026-09-20', 9),
    ];
    expect(comboDe(tasks, MOI, 'vieille')).toBe(1);
    expect(comboDe(tasks, MOI, '2')).toBe(1);
  });
});

describe('comboProchain', () => {
  it('annonce deux pour la deuxième du jour', () => {
    const tasks = [fait('1', '2026-09-20', 8)];
    expect(comboProchain(tasks, MOI, new Date(le('2026-09-20', 10)))).toBe(2);
  });

  it('annonce un quand la journée est neuve', () => {
    const tasks = [fait('1', '2026-09-19', 8)];
    expect(comboProchain(tasks, MOI, new Date(le('2026-09-20', 10)))).toBe(1);
  });

  it('rend un sans utilisateur', () => {
    expect(comboProchain([], null)).toBe(1);
  });
});

describe('les points suivent le combo', () => {
  it('double la deuxième tâche du jour', () => {
    const tasks = [fait('1', '2026-09-20', 8), fait('2', '2026-09-20', 9)];
    const d = pointsBreakdown(tasks, MOI);
    // Deux ajouts, puis 1 × POINT_OWN et 2 × POINT_OWN.
    expect(d.bonus).toBe(POINT_OWN);
    expect(d.total).toBe(2 * POINT_ADD + POINT_OWN + 2 * POINT_OWN);
  });

  it('multiplie aussi la tâche de l’autre', () => {
    const tasks = [
      fait('1', '2026-09-20', 8),
      fait('2', '2026-09-20', 9, { createdBy: AUTRE }),
    ];
    const d = pointsBreakdown(tasks, MOI);
    expect(d.total).toBe(POINT_ADD + POINT_OWN + 2 * POINT_OTHER);
  });

  it('ne multiplie pas le point d’ajout', () => {
    // Trois tâches ajoutées, une seule cochée : rien à multiplier.
    const tasks = [
      { id: '1', deleted: false, done: false, createdBy: MOI },
      { id: '2', deleted: false, done: false, createdBy: MOI },
      fait('3', '2026-09-20', 9),
    ];
    const d = pointsBreakdown(tasks, MOI);
    expect(d.bonus).toBe(0);
    expect(d.total).toBe(3 * POINT_ADD + POINT_OWN);
  });

  it('rend le combo quand on décoche au milieu', () => {
    // La troisième du jour redescend au rang deux si la deuxième s'en va.
    const tasks = [fait('1', '2026-09-20', 8), fait('3', '2026-09-20', 18)];
    expect(comboDe(tasks, MOI, '3')).toBe(2);
    expect(pointsBreakdown(tasks, MOI).bonus).toBe(POINT_OWN);
  });
});

describe('le scenario du test : cocher trois, tout decocher, recocher', () => {
  const jour = '2026-09-20';
  const maintenant = new Date(le(jour, 15));

  it('repart de un quand tout a ete decoche', () => {
    // Trois taches cochees puis decochees : la decoche efface l'instant,
    // donc plus rien ne compte pour la journee.
    const apresDecoche = ['a', 'b', 'c'].map((id) => ({
      id,
      deleted: false,
      done: false,
      doneBy: null,
      doneAt: null,
      createdBy: MOI,
    }));
    expect(comboProchain(apresDecoche, MOI, maintenant)).toBe(1);
  });

  it('compte une tache restee cochee ailleurs dans la liste', () => {
    // Le combo regarde toute la journee, pas seulement le mois affiche :
    // une tache cochee plus tot compte, et c'est voulu.
    const tasks = [
      { id: 'a', deleted: false, done: false, doneBy: null, doneAt: null, createdBy: MOI },
      fait('oubliee', jour, 9),
    ];
    expect(comboProchain(tasks, MOI, maintenant)).toBe(2);
  });
});

describe('le combo à un demi-point, à partir du 28 septembre 2026', () => {
  const jour = '2026-09-29';

  it('un demi-point de plus par tâche dès la deuxième, sans escalade', () => {
    const tasks = [fait('1', jour, 8), fait('2', jour, 9), fait('3', jour, 10), fait('4', jour, 11)];
    const d = pointsBreakdown(tasks, MOI);
    expect(COMBO_BONUS).toBe(0.5);
    expect(d.bonus).toBe(1.5);
    expect(d.total).toBe(4 * POINT_ADD + 4 * POINT_OWN + 1.5);
  });

  it('le même demi-point pour une tâche de l’autre', () => {
    const tasks = [fait('1', jour, 8), fait('2', jour, 9, { createdBy: AUTRE })];
    const d = pointsBreakdown(tasks, MOI);
    expect(d.bonus).toBe(0.5);
    expect(d.total).toBe(POINT_ADD + POINT_OWN + POINT_OTHER + 0.5);
  });

  it('les combos d’avant gardent leur calcul : les points acquis le restent', () => {
    const tasks = [
      fait('1', '2026-09-20', 8), fait('2', '2026-09-20', 9), fait('3', '2026-09-20', 10),
      fait('4', jour, 8), fait('5', jour, 9), fait('6', jour, 10),
    ];
    // Avant : ×2 puis ×3, soit 1 + 2 points en plus. Après : 0,5 + 0,5.
    expect(pointsBreakdown(tasks, MOI).bonus).toBe(3 + 1);
  });
});
