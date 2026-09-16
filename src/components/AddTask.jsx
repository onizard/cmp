import { useState } from 'react';

export default function AddTask({ onAdd }) {
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="field"
        value={text}
        placeholder="ajouter une chose à porter…"
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn btn-accent" type="submit">
        Ajouter
      </button>
    </form>
  );
}
