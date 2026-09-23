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
  toutesLesFaites,
} from '../lib/visibility.js';
import TaskItem from './TaskItem.jsx';
import AddTask from './AddTask.jsx';

/**
 * La liste ne montre que ce qui reste à porter.
 *
 * Une tâche cochée a rendu son service : elle quitte le mois et rejoint un
 * tiroir unique, au bas du mois en cours, qui les rassemble toutes — pas
 * seulement celles du mois. On l'ouvre quand on veut les revoir, et on peut
 * toujours y décocher ce qu'on a coché par erreur.
 */
export default function TaskList({ store, currentMonth, onCombo }) {
  const t = useT();
  const currentYear = currentMonth.slice(0, 4);
  const moisSuivant = addMonths(currentMonth, 1);

  const [openYears, setOpenYears] = useState(() => new Set([currentYear]));
  const [openMonths, setOpenMonths] = useState(() => new Set([currentMonth]));
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  const toggle = (set, setter, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const faites = useMemo(() => toutesLesFaites(store.tasks), [store.tasks]);

  // Chaque mois avec ses tâches à faire. Le résumé, lui, se calcule sur TOUT
  // ce que le mois contient : sans les cochées, un mois entièrement bouclé
  // afficherait « rien » au lieu de « terminé ».
  const moisRendus = useMemo(() => {
    const out = new Map();
    for (const m of displayedMonths(store.tasks, currentMonth)) {
      const tout = sortForMonth(tasksVisibleIn(store.tasks, m, currentMonth));
      const aFaire = tout.filter((x) => !x.done);
      const toujours = m === currentMonth || m === moisSuivant;
      if (aFaire.length > 0 || toujours) {
        out.set(m, { aFaire, resume: monthSummary(tout) });
      }
    }
    return out;
  }, [store.tasks, currentMonth, moisSuivant]);

  const years = groupByYear([...moisRendus.keys()]);

  const tiroir = (
    <div className="tiroir">
      <button
        type="button"
        className="tiroir-tete"
        aria-expanded={tiroirOuvert}
        onClick={() => setTiroirOuvert((v) => !v)}
      >
        <span className="tiroir-nom">{t('taches.faitesTiroir')}</span>
        <span className="tiroir-compte">{faites.length}</span>
      </button>
      {tiroirOuvert && (
        <div className="tiroir-corps">
          {faites.length === 0 ? (
            <p className="tiroir-vide">{t('taches.aucuneFaite')}</p>
          ) : (
            <ul className="tasks">
              {faites.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  month={task.doneMonth || task.month}
                  currentMonth={currentMonth}
                  store={store}
                  onCombo={onCombo}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <main className="list">
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
                const { aFaire, resume } = moisRendus.get(m);
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
                      <span className="month-count">{resume}</span>
                    </button>
                    {monthOpen && (
                      <div className="month-body">
                        <ul className="tasks">
                          {aFaire.map((task) => (
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
                        <AddTask onAdd={(text) => store.addTask(m, text)} />
                        {m === currentMonth && tiroir}
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
