import { useState } from 'react';
import { carriedFromLabel } from '../lib/visibility.js';
import { buildDue, splitDue, dueFull, dueLevel } from '../lib/deadline.js';
import DueBadge, { Chrono } from './DueBadge.jsx';

export default function TaskItem({ task, month, currentMonth, store }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [dueOpen, setDueOpen] = useState(false);
  const start = splitDue(task.dueAt, task.dueHasTime);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);

  const carried = carriedFromLabel(task, month);
  const level = task.done ? null : dueLevel(task.dueAt);

  const saveDue = (e) => {
    e.preventDefault();
    store.setDue(task.id, buildDue(date, time));
    setDueOpen(false);
    setOpen(false);
  };

  const clearDue = () => {
    store.setDue(task.id, null);
    setDate('');
    setTime('');
    setDueOpen(false);
    setOpen(false);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (text && text !== task.text) store.updateTask(task.id, { text });
    setEditing(false);
  };

  const remove = () => {
    store.removeTask(task.id);
    setOpen(false);
  };

  return (
    <li className={`task ${task.done ? 'done' : ''} ${level ? `has-due due-lvl-${level}` : ''}`}>
      <div className="task-row">
        <button
          type="button"
          className="check"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? 'Décocher' : 'Cocher'}
          onClick={() => store.toggleDone(task, currentMonth)}
        >
          <span className="check-box">{task.done ? '✓' : ''}</span>
        </button>

        {editing ? (
          <form className="edit" onSubmit={saveEdit}>
            <input
              className="field"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="edit-actions">
              <button className="btn btn-small btn-accent" type="submit">
                Enregistrer
              </button>
              <button
                className="btn btn-small"
                type="button"
                onClick={() => {
                  setDraft(task.text);
                  setEditing(false);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="task-text"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="task-label">{task.text}</span>
            {carried && <span className="carried">{carried}</span>}
            <DueBadge dueAt={task.dueAt} done={task.done} />
          </button>
        )}
      </div>

      {open && !editing && dueOpen && (
        <form className="due-form" onSubmit={saveDue}>
          <p className="due-form-title">
            <Chrono size={15} /> Échéance
          </p>
          <div className="due-fields">
            <label className="due-field">
              <span className="field-label">Jour</span>
              <input
                className="field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="due-field">
              <span className="field-label">Heure (facultative)</span>
              <input
                className="field"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <p className="due-note">
            Sans heure, l’échéance tombe en fin de journée. Les rappels se
            resserrent à mesure qu’elle approche.
          </p>
          <div className="edit-actions">
            <button className="btn btn-small btn-urgent" type="submit" disabled={!date}>
              Enregistrer
            </button>
            {task.dueAt && (
              <button className="btn btn-small" type="button" onClick={clearDue}>
                Retirer
              </button>
            )}
            <button
              className="btn btn-small"
              type="button"
              onClick={() => setDueOpen(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {open && !editing && !dueOpen && (
        <div className="actions" role="group" aria-label="Actions">
          <button
            className="action"
            type="button"
            onClick={() => store.moveTask(task, month, currentMonth, 'up')}
            disabled={task.done}
          >
            Monter
          </button>
          <button
            className="action"
            type="button"
            onClick={() => store.moveTask(task, month, currentMonth, 'down')}
            disabled={task.done}
          >
            Descendre
          </button>
          <button
            className="action"
            type="button"
            onClick={() => {
              setEditing(true);
              setOpen(false);
            }}
          >
            Modifier
          </button>
          <button
            className="action action-due"
            type="button"
            onClick={() => setDueOpen(true)}
          >
            <Chrono />
            {task.dueAt ? 'Échéance' : 'Ajouter une échéance'}
          </button>
          <button className="action action-danger" type="button" onClick={remove}>
            Supprimer
          </button>
          {task.dueAt && (
            <p className="due-recap">
              Échéance : {dueFull(task.dueAt, task.dueHasTime)}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
