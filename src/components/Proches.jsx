import { useState } from 'react';
import { useT } from '../i18n/index.js';

/**
 * Mon compte, mode famille : les membres sans compte (les enfants, par
 * exemple). Un prénom suffit. Ils cochent sur le téléphone d'un parent en
 * choisissant leur prénom, gagnent des points et prennent des bons comme les
 * autres. Retirer quelqu'un garde son historique.
 */
export default function Proches({ rewards }) {
  const t = useT();
  const [nom, setNom] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const actifs = (rewards.proches || []).filter((p) => p.actif);

  const ajouter = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setOccupe(true);
    if (await rewards.ajouterProche(nom)) setNom('');
    setOccupe(false);
  };

  return (
    <div className="proches">
      <p className="field-label">{t('proches.titre')}</p>
      <p className="setnote">{t('proches.aide')}</p>
      {actifs.length > 0 && (
        <ul className="equipe-liste">
          {actifs.map((p) => (
            <li key={p.id}>
              <span className="equipe-nom">{p.nom}</span>
              {aRetirer === p.id ? (
                <span className="equipe-confirmer">
                  <button
                    type="button"
                    className="link equipe-retirer"
                    onClick={() => {
                      setARetirer(null);
                      rewards.retirerProche(p.id);
                    }}
                  >
                    {t('proches.retirerOui')}
                  </button>
                  <button className="link" type="button" onClick={() => setARetirer(null)}>
                    {t('app.annuler')}
                  </button>
                </span>
              ) : (
                <button className="link equipe-bascule" type="button" onClick={() => setARetirer(p.id)}>
                  {t('proches.retirer')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="equipe-ligne proches-ajout" onSubmit={ajouter}>
        <input
          className="field"
          type="text"
          name="cmp-proche"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          maxLength={40}
          placeholder={t('entreprise.prenom')}
          aria-label={t('entreprise.prenom')}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <button className="btn btn-accent" type="submit" disabled={occupe || !nom.trim()}>
          {t('taches.boutonAjouter')}
        </button>
      </form>
    </div>
  );
}
