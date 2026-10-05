import { useState } from 'react';
import { useT } from '../i18n/index.js';
import { postePartage, activerPostePartage, desactiverPostePartage } from '../lib/comptes.js';

/**
 * Compte pro, Mon compte : « Ordinateur partagé ». Sur un poste du bureau,
 * l'appareil ne garde plus que ce compte pro : les autres (le perso de
 * quelqu'un) en partent avec leurs données, et plus aucun ne peut s'y
 * ajouter ni s'y ouvrir. L'activer : une confirmation. Le désactiver : le
 * code responsable, pour qu'un collègue ne puisse pas le couper.
 */
export default function PostePartage({ account, equipe, onChange }) {
  const t = useT();
  const [actif, setActif] = useState(() => Boolean(postePartage()));
  const [etape, setEtape] = useState(null); // 'activer' | 'desactiver'
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const fermer = () => {
    setEtape(null);
    setCode('');
    setErreur(null);
  };

  const activer = () => {
    activerPostePartage({
      userId: account.session.user.id,
      email: account.session.user.email,
      hid: account.household?.id,
    });
    setActif(true);
    fermer();
    onChange?.();
  };

  const desactiver = async (e) => {
    e.preventDefault();
    setOccupe(true);
    const r = await equipe.verifierResponsable(code);
    setOccupe(false);
    if (r) {
      setCode('');
      setErreur(r === 'faux' ? t('entreprise.codeRespFaux') : r);
      return;
    }
    desactiverPostePartage();
    setActif(false);
    fermer();
    onChange?.();
  };

  return (
    <>
      <div className="rowline">
        <span>{t('poste.libelle')}</span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={actif}
          aria-label={t('poste.libelle')}
          onClick={() => setEtape(actif ? 'desactiver' : 'activer')}
        />
      </div>
      <p className="setnote">{actif ? t('poste.actif') : t('poste.aide')}</p>

      {etape === 'activer' && (
        <div className="poste-bloc">
          <p className="poste-texte">{t('poste.confirmer')}</p>
          <button className="btn btn-accent btn-block" type="button" onClick={activer}>
            {t('poste.activer')}
          </button>
          <button className="btn btn-block" type="button" onClick={fermer}>
            {t('app.annuler')}
          </button>
        </div>
      )}

      {etape === 'desactiver' && (
        <form className="poste-bloc" onSubmit={desactiver}>
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
            autoFocus
            placeholder={t('entreprise.codeResp')}
            aria-label={t('entreprise.codeResp')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
          {erreur && <p className="error">{erreur}</p>}
          <button className="btn btn-accent btn-block" type="submit" disabled={occupe || code.length < 4}>
            {occupe ? t('app.instant') : t('poste.desactiver')}
          </button>
          <button className="btn btn-block" type="button" onClick={fermer}>
            {t('app.annuler')}
          </button>
        </form>
      )}
    </>
  );
}
