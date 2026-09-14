import { useState } from 'react';

export default function AddTask({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
    // On reste ouvert pour enchaîner plusieurs ajouts.
  };

  if (!open) {
    return (
      <button className="add-open" type="button" onClick={() => setOpen(true)}>
        Ajouter une tâche
      </button>
    );
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="field"
        value={text}
        autoFocus
        placeholder="Quoi de neuf à faire ?"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="add-actions">
        <button className="btn btn-small btn-accent" type="submit">
          Ajouter
        </button>
        <button
          className="btn btn-small"
          type="button"
          onClick={() => {
            setText('');
            setOpen(false);
          }}
        >
          Fermer
        </button>
      </div>
    </form>
  );
}
