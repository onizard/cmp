import { useState } from 'react';
import { useT } from '../i18n/index.js';
import { CaseCode, motErreur } from './CodesFamille.jsx';

/**
 * Mon compte, mode famille : les membres sans compte (les enfants, par
 * exemple). Un prénom suffit. Ils cochent sur le téléphone d'un parent en
 * choisissant leur prénom, gagnent des points et prennent des bons comme les
 * autres. Retirer quelqu'un garde son historique.
 *
 * Chacun peut avoir un code pour ses bons : c'est un parent qui le choisit,
 * en confirmant avec son propre code (codes.sql).
 */
export default function Proches({ rewards, userId }) {
  const t = useT();
  const [nom, setNom] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const actifs = (rewards.proches || []).filter((p) => p.actif);
  const avecCode = new Set(rewards.avecCode || []);
  const [codeDe, setCodeDe] = useState(null);
  const [nouveau, setNouveau] = useState('');
  const [preuve, setPreuve] = useState('');
  const [message, setMessage] = useState(null);

  const fermerCode = () => {
    setCodeDe(null);
    setNouveau('');
    setPreuve('');
  };
  const poserCode = async (e) => {
    e.preventDefault();
    setOccupe(true);
    const r = await rewards.poserCode(codeDe, nouveau, preuve);
    setOccupe(false);
    if (r) {
      setMessage({ erreur: true, texte: motErreur(t, r) });
      setPreuve('');
      return;
    }
    setMessage({ erreur: false, texte: t('codes.enregistre') });
    fermerCode();
  };

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
              <span className="equipe-nom">
                {p.nom}
                {avecCode.has(p.id) && <span className="proche-verrou" aria-label={t('codes.aUnCode')}> 🔒</span>}
              </span>
              <button
                className="link equipe-bascule"
                type="button"
                onClick={() => {
                  setMessage(null);
                  setCodeDe(codeDe === p.id ? null : p.id);
                }}
              >
                {t('codes.code')}
              </button>
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
              {codeDe === p.id && (
                <form className="codes-form proche-code" onSubmit={poserCode}>
                  {!avecCode.has(userId) ? (
                    <p className="setnote">{t('codes.parentSansCode')}</p>
                  ) : (
                    <>
                      <CaseCode valeur={nouveau} onChange={setNouveau} placeholder={t('codes.nouveauDe', { nom: p.nom })} autoFocus />
                      <CaseCode valeur={preuve} onChange={setPreuve} placeholder={t('codes.tonCode')} />
                      <div className="codes-actions">
                        <button className="btn btn-accent" type="submit" disabled={occupe || nouveau.length !== 4 || preuve.length !== 4}>
                          {t('app.enregistrer')}
                        </button>
                        <button className="btn" type="button" onClick={fermerCode}>
                          {t('app.annuler')}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p className={message.erreur ? 'error' : 'setnote codes-ok'}>{message.texte}</p>}
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
