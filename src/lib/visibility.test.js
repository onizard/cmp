import { describe, it, expect } from 'vitest';
import {
  lastVisibleMonth,
  visibleIn,
  sortForMonth,
  displayedMonths,
  groupByYear,
  headline,
  monthSummary,
  carriedFromLabel,
  addMonths,
  monthRange,
  monthName,
} from './visibility.js';

const task = (over = {}) => ({
  id: over.id || 'x',
  text: 'tâche',
  month: '2026-03',
  position: 0,
  done: false,
  doneMonth: null,
  deleted: false,
  createdAt: '2026-03-01T00:00:00Z',
  ...over,
});

describe('lastVisibleMonth', () => {
  it('reporte une tâche non cochée jusqu\'au mois en cours', () => {
    expect(lastVisibleMonth(task({ month: '2026-03' }), '2026-06')).toBe('2026-06');
  });
  it('une tâche future reste bornée à son mois', () => {
    expect(lastVisibleMonth(task({ month: '2026-09' }), '2026-06')).toBe('2026-09');
  });
  it('une tâche cochée est bornée au mois où elle a été cochée', () => {
    expect(
      lastVisibleMonth(task({ done: true, doneMonth: '2026-04' }), '2026-06'),
    ).toBe('2026-04');
  });
});

describe('visibleIn — tâche non cochée reportée', () => {
  const t = task({ month: '2026-03' });
  const current = '2026-06';
  it('n\'apparaît pas avant son mois d\'origine', () => {
    expect(visibleIn(t, '2026-02', current)).toBe(false);
  });
  it('apparaît dès son mois d\'origine', () => {
    expect(visibleIn(t, '2026-03', current)).toBe(true);
  });
  it('reste visible dans les mois intermédiaires', () => {
    expect(visibleIn(t, '2026-04', current)).toBe(true);
    expect(visibleIn(t, '2026-05', current)).toBe(true);
  });
  it('est visible dans le mois en cours', () => {
    expect(visibleIn(t, '2026-06', current)).toBe(true);
  });
  it('n\'apparaît pas dans le futur (au-delà du mois en cours)', () => {
    expect(visibleIn(t, '2026-07', current)).toBe(false);
  });
});

describe('visibleIn — tâche cochée qui disparaît le mois suivant', () => {
  const t = task({ month: '2026-03', done: true, doneMonth: '2026-04' });
  const current = '2026-06';
  it('reste consultable dans le mois où elle a été cochée', () => {
    expect(visibleIn(t, '2026-04', current)).toBe(true);
  });
  it('reste visible depuis son mois d\'origine jusqu\'à doneMonth', () => {
    expect(visibleIn(t, '2026-03', current)).toBe(true);
  });
  it('disparaît le mois suivant celui où elle a été cochée', () => {
    expect(visibleIn(t, '2026-05', current)).toBe(false);
    expect(visibleIn(t, '2026-06', current)).toBe(false);
  });
});

describe('visibleIn — tâche future', () => {
  const t = task({ month: '2026-09' });
  const current = '2026-06';
  it('n\'apparaît que dans son mois', () => {
    expect(visibleIn(t, '2026-06', current)).toBe(false);
    expect(visibleIn(t, '2026-08', current)).toBe(false);
    expect(visibleIn(t, '2026-09', current)).toBe(true);
    expect(visibleIn(t, '2026-10', current)).toBe(false);
  });
});

describe('visibleIn — tâche décochée repart dans le flux normal', () => {
  it('décocher (done=false, doneMonth=null) redonne le report jusqu\'au mois en cours', () => {
    const recochee = task({ month: '2026-03', done: true, doneMonth: '2026-04' });
    const current = '2026-06';
    expect(visibleIn(recochee, '2026-06', current)).toBe(false);
    // On décoche :
    const decochee = { ...recochee, done: false, doneMonth: null };
    expect(visibleIn(decochee, '2026-06', current)).toBe(true);
    expect(visibleIn(decochee, '2026-05', current)).toBe(true);
  });
});

describe('visibleIn — tâche supprimée', () => {
  it('n\'est jamais visible', () => {
    const t = task({ deleted: true });
    expect(visibleIn(t, '2026-03', '2026-06')).toBe(false);
  });
});

describe('sortForMonth', () => {
  it('les cochées descendent en bas', () => {
    const list = [
      task({ id: 'a', done: true, doneMonth: '2026-03' }),
      task({ id: 'b', done: false }),
    ];
    expect(sortForMonth(list).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('ce qui a une échéance passe devant, la plus proche en tête', () => {
    const list = [
      task({ id: 'sans' }),
      task({ id: 'loin', dueAt: '2026-03-20T10:00:00Z' }),
      task({ id: 'proche', dueAt: '2026-03-02T10:00:00Z' }),
    ];
    expect(sortForMonth(list).map((t) => t.id)).toEqual([
      'proche',
      'loin',
      'sans',
    ]);
  });

  it('sans échéance, l’ordre est chronologique', () => {
    const list = [
      task({ id: 'tard', createdAt: '2026-03-09T00:00:00Z' }),
      task({ id: 'tot', createdAt: '2026-03-02T00:00:00Z' }),
    ];
    expect(sortForMonth(list).map((t) => t.id)).toEqual(['tot', 'tard']);
  });

  it('l’alphabétique départage à date égale', () => {
    const list = [
      task({ id: 'z', text: 'Zéro', createdAt: '2026-03-02T00:00:00Z' }),
      task({ id: 'a', text: 'Arroser', createdAt: '2026-03-02T00:00:00Z' }),
      task({ id: 'm', text: 'manger', createdAt: '2026-03-02T00:00:00Z' }),
    ];
    expect(sortForMonth(list).map((t) => t.id)).toEqual(['a', 'm', 'z']);
  });

  it('une échéance sur une tâche cochée ne la fait pas remonter', () => {
    const list = [
      task({ id: 'faite', done: true, doneMonth: '2026-03', dueAt: '2026-03-01T08:00:00Z' }),
      task({ id: 'restante' }),
    ];
    expect(sortForMonth(list).map((t) => t.id)).toEqual(['restante', 'faite']);
  });
});

describe('displayedMonths', () => {
  it('inclut toujours le mois en cours et le suivant, ordre antichrono', () => {
    const months = displayedMonths([], '2026-06');
    expect(months).toEqual(['2026-07', '2026-06']);
  });
  it('inclut les mois intermédiaires d\'une tâche reportée', () => {
    const months = displayedMonths([task({ month: '2026-04' })], '2026-06');
    expect(months).toEqual(['2026-07', '2026-06', '2026-05', '2026-04']);
  });
  it('inclut le mois d\'une tâche future', () => {
    const months = displayedMonths([task({ month: '2026-09' })], '2026-06');
    expect(months).toContain('2026-09');
    expect(months[0]).toBe('2026-09'); // le plus récent en tête
  });
  it('n\'inclut pas un mois passé sans tâche visible', () => {
    const months = displayedMonths([task({ month: '2026-06' })], '2026-06');
    expect(months).not.toContain('2026-01');
  });
});

describe('groupByYear', () => {
  it('regroupe les mois par année en conservant l\'ordre', () => {
    const groups = groupByYear(['2027-01', '2026-12', '2026-11']);
    expect(groups).toEqual([
      { year: '2027', months: ['2027-01'] },
      { year: '2026', months: ['2026-12', '2026-11'] },
    ]);
  });
});

describe('headline', () => {
  it('gère le cas zéro', () => expect(headline(0)).toBe('Rien en tête ce mois-ci.'));
  it('gère le singulier', () => expect(headline(1)).toBe('1 chose en tête ce mois-ci.'));
  it('gère le pluriel', () => expect(headline(7)).toBe('7 choses en tête ce mois-ci.'));
});

describe('monthSummary', () => {
  it('« N à faire » quand il reste des tâches', () => {
    expect(monthSummary([task(), task({ done: true, doneMonth: '2026-03' })])).toBe('1 à faire');
  });
  it('« terminé » quand tout est coché', () => {
    expect(monthSummary([task({ done: true, doneMonth: '2026-03' })])).toBe('terminé');
  });
  it('« rien » quand le mois est vide', () => {
    expect(monthSummary([])).toBe('rien');
  });
});

describe('carriedFromLabel', () => {
  it('affiche « depuis mars » pour une tâche non cochée reportée', () => {
    expect(carriedFromLabel(task({ month: '2026-03' }), '2026-06')).toBe('depuis mars');
  });
  it('n\'affiche rien dans le mois d\'origine', () => {
    expect(carriedFromLabel(task({ month: '2026-03' }), '2026-03')).toBe(null);
  });
  it('n\'affiche rien pour une tâche cochée', () => {
    expect(carriedFromLabel(task({ month: '2026-03', done: true, doneMonth: '2026-04' }), '2026-04')).toBe(null);
  });
});

describe('utilitaires de mois', () => {
  it('addMonths gère le passage d\'année', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  it('monthRange est inclusif', () => {
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('monthName donne le mois en français minuscule', () => {
    expect(monthName('2026-08')).toBe('août');
  });
});
