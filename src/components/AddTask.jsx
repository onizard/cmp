import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';

export default function AddTask({ onAdd }) {
  const [text, setText] = useState('');
  const [deja, setDeja] = useState(false);
  const minuteur = useRef(null);
  const t = useT();

  useEffect(() => () => clearTimeout(minuteur.current), []);

  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    // La même tâche attend déjà : on ne la double pas, on le dit, et la liste
    // descend jusqu'à elle.
    const r = onAdd(v);
    setText('');
    clearTimeout(minuteur.current);
    setDeja(Boolean(r && r.doublon));
    if (r && r.doublon) minuteur.current = setTimeout(() => setDeja(false), 3200);
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
      {deja && <p className="add-deja">{t('taches.dejaLa')}</p>}
    </form>
  );
}
