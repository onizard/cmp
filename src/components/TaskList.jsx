import { useState } from 'react';
import {
  displayedMonths,
  groupByYear,
  monthName,
  tasksVisibleIn,
  sortForMonth,
  monthSummary,
} from '../lib/visibility.js';
import TaskItem from './TaskItem.jsx';
import AddTask from './AddTask.jsx';

export default function TaskList({ store, currentMonth }) {
  const currentYear = currentMonth.slice(0, 4);
  const months = displayedMonths(store.tasks, currentMonth);
  const years = groupByYear(months);

  const [openYears, setOpenYears] = useState(() => new Set([currentYear]));
  const [openMonths, setOpenMonths] = useState(() => new Set([currentMonth]));

  const toggle = (set, setter, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

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
                const visible = sortForMonth(
                  tasksVisibleIn(store.tasks, m, currentMonth),
                );
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
                        {monthSummary(visible)}
                      </span>
                    </button>
                    {monthOpen && (
                      <div className="month-body">
                        <ul className="tasks">
                          {visible.map((t) => (
                            <TaskItem
                              key={t.id}
                              task={t}
                              month={m}
                              currentMonth={currentMonth}
                              store={store}
                            />
                          ))}
                        </ul>
                        <AddTask
                          onAdd={(text) => store.addTask(m, text)}
                        />
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
