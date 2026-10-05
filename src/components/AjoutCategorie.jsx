import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Suggestions from './Suggestions.jsx';

/**
 * Au bas du mois : « Ajouter une catégorie ». Un toucher ouvre la case ; en
 * tapant, les catégories déjà employées se proposent dessous (la plus
 * fréquente, puis la plus récente) et un toucher suffit à l'ajouter.
 */
export default function AjoutCategorie({ onAjouter, suggerer = () => [] }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');

  const fermer = () => {
    setOuvert(false);
    setNom('');
  };
  const ajouter = (n) => {
    if (!String(n || '').trim()) return;
    onAjouter(n);
    fermer();
  };

  if (!ouvert) {
    return (
      <button type="button" className="categorie-ajout" onClick={() => setOuvert(true)}>
        <span aria-hidden="true">＋</span> {t('categories.ajouter')}
      </button>
    );
  }

  return (
    <form
      className="add-form categorie-form"
      onSubmit={(e) => {
        e.preventDefault();
        ajouter(nom);
      }}
    >
      <input
        className="field"
        autoFocus
        maxLength={40}
        value={nom}
        placeholder={t('categories.nom')}
        aria-label={t('categories.nom')}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fermer();
        }}
      />
      <button className="btn btn-accent" type="submit" disabled={!nom.trim()}>
        {t('taches.boutonAjouter')}
      </button>
      <Suggestions noms={suggerer(nom)} label={t('categories.suggestions')} onChoisir={ajouter} />
      <button type="button" className="link categorie-annuler" onClick={fermer}>
        {t('app.annuler')}
      </button>
    </form>
  );
}
