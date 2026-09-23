import { useMemo, useState } from 'react';
import { useT } from '../i18n/index.js';
import {
  addMonths,
  displayedMonths,
  groupByYear,
  monthName,
  tasksVisibleIn,
  sortForMonth,
  monthSummary,
} from '../lib/visibility.js';
import TaskItem from './TaskItem.jsx';
import AddTask from './AddTask.jsx';

/**
 * La liste, en deux vues.
 *
 * Ce qui reste à faire tient le devant : une tâche cochée a déjà rendu son
 * service, elle n'a plus à encombrer. Elle passe dans « Faites », où on la
 * retrouve — et d'où on peut toujours la décocher si on s'est trompé.
 *
 * Le découpage par année et par mois ne change pas d'une vue à l'autre : c'est
 * le même classement, seul le filtre diffère.
 */
export default function TaskList({ store, currentMonth, onCombo }) {
  const t = useT();
  const [vue, setVue] = useState('todo');
  const currentYear = currentMonth.slice(0, 4);
  const moisSuivant = addMonths(currentMonth, 1);

  const [openYears, setOpenYears] = useState(() => new Set([currentYear]));
  const [openMonths, setOpenMonths] = useState(() => new Set([currentMonth]));

  const toggle = (set, setter, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const faitesEnTout = useMemo(
    () => store.tasks.filter((x) => !x.deleted && x.done).length,
    [store.tasks],
  );

  // Les mois à montrer dans la vue courante, avec leurs tâches déjà filtrées.
  // Un mois vide disparaît — sauf le mois en cours et le suivant côté « à
  // faire », où il faut pouvoir ajouter même quand il n'y a rien.
  const moisRendus = useMemo(() => {
    const garde = vue === 'faites';
    const out = new Map();
    for (const m of displayedMonths(store.tasks, currentMonth)) {
      const liste = sortForMonth(
        tasksVisibleIn(store.tasks, m, currentMonth),
      ).filter((x) => (garde ? x.done : !x.done));
      const toujours = !garde && (m === currentMonth || m === moisSuivant);
      if (liste.length > 0 || toujours) out.set(m, liste);
    }
    return out;
  }, [store.tasks, currentMonth, moisSuivant, vue]);

  const years = groupByYear([...moisRendus.keys()]);

  return (
    <main className="list">
      <div className="sous-onglets" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'todo'}
          className={`sous-onglet ${vue === 'todo' ? 'active' : ''}`}
          onClick={() => setVue('todo')}
        >
          {t('taches.vueAFaire')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vue === 'faites'}
          className={`sous-onglet ${vue === 'faites' ? 'active' : ''}`}
          onClick={() => setVue('faites')}
        >
          {t('taches.vueFaites')}
          {faitesEnTout > 0 && (
            <span className="sous-onglet-compte">{faitesEnTout}</span>
          )}
        </button>
      </div>

      {years.length === 0 && (
        <p className="notice">{t('taches.aucuneFaite')}</p>
      )}

      {years.map(({ year, months: yMonths }) => {
        const yearOpen = openYears.has(year);
        return (
          <section className="year" key={year}>
            <button
              className="year-head"
              type="button"
              aria-expanded={yearOpen}
              onClick={() => toggle(openYears, setOpenYears, year)}
            >
              <span className="year-num">{year}</span>
            </button>
            {yearOpen &&
              yMonths.map((m) => {
                const visible = moisRendus.get(m) || [];
                const monthOpen = openMonths.has(m);
                return (
                  <section
                    className={`month ${monthOpen ? 'open' : 'closed'}`}
                    key={m}
                  >
                    <button
                      className="month-head"
                      type="button"
                      aria-expanded={monthOpen}
                      onClick={() => toggle(openMonths, setOpenMonths, m)}
                    >
                      <span className="month-name">{monthName(m)}</span>
                      <span className="month-count">
                        {vue === 'faites'
                          ? t('taches.faitesN', { n: visible.length })
                          : monthSummary(visible)}
                      </span>
                    </button>
                    {monthOpen && (
                      <div className="month-body">
                        <ul className="tasks">
                          {visible.map((task) => (
                            <TaskItem
                              key={task.id}
                              task={task}
                              month={m}
                              currentMonth={currentMonth}
                              store={store}
                              onCombo={onCombo}
                            />
                          ))}
                        </ul>
                        {vue === 'todo' && (
                          <AddTask onAdd={(text) => store.addTask(m, text)} />
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
          </section>
        );
      })}
    </main>
  );
}
