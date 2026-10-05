import { useState } from 'react';
import { useT } from '../i18n/index.js';

// Une case pour un code à 4 chiffres, masquée et ignorée des gestionnaires de
// mots de passe (cf. EquipeReglages).
export function CaseCode({ valeur, onChange, placeholder, autoFocus = false }) {
  return (
    <input
      className="field code-masque"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      autoFocus={autoFocus}
      maxLength={4}
      placeholder={placeholder}
      aria-label={placeholder}
      value={valeur}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
    />
  );
}

export const motErreur = (t, r) =>
  ({
    faux: t('codes.faux'),
    format: t('codes.format'),
    parentSansCode: t('codes.parentSansCode'),
  })[r] || r;

/**
 * Mon compte, mode famille : mon code. Il protège mes bons et ouvre les
 * récompenses de couple. Le changer demande l'ancien.
 */
export default function CodesFamille({ rewards, userId }) {
  const t = useT();
  const aMonCode = (rewards.avecCode || []).includes(userId);
  const [ouvert, setOuvert] = useState(false);
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [message, setMessage] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const fermer = () => {
    setOuvert(false);
    setAncien('');
    setNouveau('');
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setOccupe(true);
    setMessage(null);
    const r = await rewards.poserCode(userId, nouveau, aMonCode ? ancien : null);
    setOccupe(false);
    if (r) {
      setMessage({ erreur: true, texte: motErreur(t, r) });
      return;
    }
    setMessage({ erreur: false, texte: t('codes.enregistre') });
    fermer();
  };

  const formulaire = (avecAncien) => (
    <form className="codes-form" onSubmit={enregistrer}>
      {avecAncien && <CaseCode valeur={ancien} onChange={setAncien} placeholder={t('codes.ancien')} autoFocus />}
      <CaseCode valeur={nouveau} onChange={setNouveau} placeholder={t('codes.nouveau')} autoFocus={!avecAncien} />
      <div className="codes-actions">
        <button
          className="btn btn-accent"
          type="submit"
          disabled={occupe || nouveau.length !== 4 || (avecAncien && ancien.length !== 4)}
        >
          {t('app.enregistrer')}
        </button>
        <button className="btn" type="button" onClick={fermer}>
          {t('app.annuler')}
        </button>
      </div>
    </form>
  );

  return (
    <div className="codes-famille">
      <p className="field-label">{t('codes.monTitre')}</p>
      <p className="setnote">{t('codes.monAide')}</p>
      {ouvert ? (
        formulaire(aMonCode)
      ) : (
        <button className="btn btn-block" type="button" onClick={() => setOuvert(true)}>
          {aMonCode ? t('codes.changer') : t('codes.choisir')}
        </button>
      )}

      {message && <p className={message.erreur ? 'error' : 'setnote codes-ok'}>{message.texte}</p>}
    </div>
  );
}
