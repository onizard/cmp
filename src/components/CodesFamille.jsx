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
    deja: t('couple.deja'),
    admin: t('couple.pasAdmin'),
  })[r] || r;

/**
 * Mon compte, mode famille : mon code pour mes bons, et le code couple (le
 * premier parent qui le choisit en devient l'administrateur ; lui seul le
 * change, avec l'ancien).
 */
export default function CodesFamille({ rewards, userId }) {
  const t = useT();
  const aMonCode = (rewards.avecCode || []).includes(userId);
  const couple = rewards.couple || { code: false, admin: false };
  const [ouvert, setOuvert] = useState(null); // 'moi' | 'couple'
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [message, setMessage] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const fermer = () => {
    setOuvert(null);
    setAncien('');
    setNouveau('');
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setOccupe(true);
    setMessage(null);
    let r;
    if (ouvert === 'moi') r = await rewards.poserCode(userId, nouveau, aMonCode ? ancien : null);
    else if (couple.code) r = await rewards.changerCodeCouple(ancien, nouveau);
    else r = await rewards.poserCodeCouple(nouveau);
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
      <p className="setnote">{aMonCode ? t('codes.monActif') : t('codes.monAide')}</p>
      {ouvert === 'moi' ? (
        formulaire(aMonCode)
      ) : (
        <button className="btn btn-block" type="button" onClick={() => setOuvert('moi')}>
          {aMonCode ? t('codes.changer') : t('codes.choisir')}
        </button>
      )}

      <p className="field-label codes-couple-titre">🔒 {t('couple.titre')}</p>
      <p className="setnote">
        {!couple.code ? t('couple.reglage') : couple.admin ? t('couple.actifAdmin') : t('couple.actifAutre')}
      </p>
      {(!couple.code || couple.admin) &&
        (ouvert === 'couple' ? (
          formulaire(couple.code)
        ) : (
          <button className="btn btn-block" type="button" onClick={() => setOuvert('couple')}>
            {couple.code ? t('couple.changer') : t('couple.activer')}
          </button>
        ))}

      {message && <p className={message.erreur ? 'error' : 'setnote codes-ok'}>{message.texte}</p>}
    </div>
  );
}
