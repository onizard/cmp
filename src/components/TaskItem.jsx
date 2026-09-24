import { useState } from 'react';
import { useT } from '../i18n/index.js';
import { carriedFromLabel } from '../lib/visibility.js';
import { buildDue, splitDue, dueFull, dueLevel } from '../lib/deadline.js';
import DueBadge, { Chrono } from './DueBadge.jsx';

export default function TaskItem({ task, month, currentMonth, store, onCombo }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [dueOpen, setDueOpen] = useState(false);
  const [refus, setRefus] = useState(false);
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
          aria-label={task.done ? t('taches.decocher') : t('taches.cocher')}
          onClick={() => {
            const combo = store.toggleDone(task, currentMonth);
            if (combo === false) {
              // On explique au lieu de rester inerte : un bouton mort passe
              // pour une panne.
              setRefus(true);
              setTimeout(() => setRefus(false), 3200);
              return;
            }
            if (combo > 1) onCombo(combo);
          }}
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
                {t('app.enregistrer')}
              </button>
              <button
                className="btn btn-small"
                type="button"
                onClick={() => {
                  setDraft(task.text);
                  setEditing(false);
                }}
              >
                {t('app.annuler')}
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

      {refus && <p className="refus">{t('taches.decocheInterdite')}</p>}

      {open && !editing && dueOpen && (
        <form className="due-form" onSubmit={saveDue}>
          <p className="due-form-title">
            <Chrono size={15} /> {t('echeance.titre')}
          </p>
          <div className="due-fields">
            <label className="due-field">
              <span className="field-label">{t('echeance.jour')}</span>
              <input
                className="field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="due-field">
              <span className="field-label">{t('echeance.heure')}</span>
              <input
                className="field"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <p className="due-note">
{t('echeance.aide')}
          </p>
          <div className="edit-actions">
            <button className="btn btn-small btn-urgent" type="submit" disabled={!date}>
              {t('app.enregistrer')}
            </button>
            {task.dueAt && (
              <button className="btn btn-small" type="button" onClick={clearDue}>
                {t('echeance.retirer')}
              </button>
            )}
            <button
              className="btn btn-small"
              type="button"
              onClick={() => setDueOpen(false)}
            >
              {t('app.annuler')}
            </button>
          </div>
        </form>
      )}

      {/* La tâche de l'autre : on la coche, on ne la réécrit pas. On explique
          pourquoi plutôt que d'ouvrir un menu vide. */}
      {open && !store.peutModifier(task) && (
        <div className="actions actions-autre">
          <p className="refus refus-doux">{t('taches.modifInterdite')}</p>
          {task.dueAt && (
            <p className="due-recap">
              {t('echeance.recap', { quand: dueFull(task.dueAt, task.dueHasTime) })}
            </p>
          )}
        </div>
      )}

      {open && !editing && !dueOpen && store.peutModifier(task) && (
        <div className="actions" role="group" aria-label={t('taches.actions')}>
          <button
            className="action"
            type="button"
            onClick={() => {
              setEditing(true);
              setOpen(false);
            }}
          >
            {t('taches.modifier')}
          </button>
          <button
            className="action action-due"
            type="button"
            onClick={() => setDueOpen(true)}
          >
            <Chrono />
            {task.dueAt ? t('echeance.titre') : t('echeance.ajouter')}
          </button>
          <button className="action action-danger" type="button" onClick={remove}>
            {t('taches.supprimer')}
          </button>
          {task.dueAt && (
            <p className="due-recap">
              {t('echeance.recap', { quand: dueFull(task.dueAt, task.dueHasTime) })}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
