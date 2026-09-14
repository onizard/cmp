import { useState } from 'react';
import { carriedFromLabel } from '../lib/visibility.js';

export default function TaskItem({ task, month, currentMonth, store }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const carried = carriedFromLabel(task, month);

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
    <li className={`task ${task.done ? 'done' : ''}`}>
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
          </button>
        )}
      </div>

      {open && !editing && (
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
          <button className="action action-danger" type="button" onClick={remove}>
            Supprimer
          </button>
        </div>
      )}
    </li>
  );
}
