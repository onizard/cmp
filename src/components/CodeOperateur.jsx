import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/**
 * Mode entreprise : la fenêtre qui demande le code opérateur avant d'agir.
 *
 * Un pavé à chiffres ; au quatrième, on valide tout seul. `onValider(code)`
 * renvoie null si c'est bon (la fenêtre se ferme), sinon le message à
 * afficher — le code s'efface et on recommence. Le clavier physique marche
 * aussi : chiffres, retour arrière, Échap pour fermer.
 */
export default function CodeOperateur({ titre, detail, onValider, onFermer }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const taper = async (touche) => {
    if (occupe) return;
    if (touche === '⌫') {
      setCode((c) => c.slice(0, -1));
      return;
    }
    if (!/^[0-9]$/.test(touche) || code.length >= 4) return;
    const suivant = code + touche;
    setCode(suivant);
    setErreur(null);
    if (suivant.length < 4) return;
    setOccupe(true);
    const message = await onValider(suivant);
    setOccupe(false);
    if (message) {
      setErreur(message);
      setCode('');
    }
  };

  useEffect(() => {
    const auClavier = (e) => {
      if (e.key === 'Escape') onFermer();
      else if (e.key === 'Backspace') taper('⌫');
      else if (/^[0-9]$/.test(e.key)) taper(e.key);
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  });

  return (
    <div className="code-voile" role="dialog" aria-modal="true" aria-labelledby="code-titre">
      <div className={`code-carte ${erreur ? 'code-faux' : ''}`}>
        <h2 id="code-titre" className="code-titre">{titre}</h2>
        {detail && <p className="code-detail">{detail}</p>}
        <div className="code-points" aria-label={t('entreprise.codeSaisi', { n: code.length })}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < code.length ? 'plein' : ''} />
          ))}
        </div>
        <p className="code-erreur" role="alert">{erreur || ' '}</p>
        <div className="code-pave">
          {TOUCHES.map((touche, i) =>
            touche ? (
              <button
                key={i}
                type="button"
                className={`code-touche ${touche === '⌫' ? 'code-efface' : ''}`}
                aria-label={touche === '⌫' ? t('entreprise.effacer') : touche}
                onClick={() => taper(touche)}
                disabled={occupe}
              >
                {touche}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <button className="btn btn-block code-annuler" type="button" onClick={onFermer}>
          {t('app.annuler')}
        </button>
      </div>
    </div>
  );
}
