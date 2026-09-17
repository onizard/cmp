import { useState } from 'react';
import { useT } from '../i18n/index.js';

export default function AddTask({ onAdd }) {
  const [text, setText] = useState('');
  const t = useT();

  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="field"
        value={text}
        placeholder={t('taches.ajouter')}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn btn-accent" type="submit">
        {t('taches.boutonAjouter')}
      </button>
    </form>
  );
}
