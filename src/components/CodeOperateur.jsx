import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/**
 * Mode entreprise : la fenêtre qui demande le code opérateur avant d'agir.
 *
 * Un pavé à chiffres ; au quatrième, on valide tout seul. `onValider(code)`
 * renvoie null si c'est bon (la fenêtre se ferme), sinon le message à
 * afficher — le code s'efface et on recommence.
 *
 * Sur ordinateur, on tape au clavier : la rangée des chiffres comme le pavé
 * numérique, Verr Num allumé ou pas (on lit la touche physique, pas le
 * caractère). Retour arrière ou Suppr efface, Échap ferme. La fenêtre prend
 * le focus en s'ouvrant : rien ne s'écrit dans le champ resté derrière.
 */
// `extra` : sous le pavé (un lien « Pas de code ? », par exemple).
export default function CodeOperateur({ titre, detail, onValider, onFermer, extra = null }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const carte = useRef(null);

  // Le focus quitte le champ « ajoute une tâche » pour la fenêtre.
  useEffect(() => {
    carte.current?.focus();
  }, []);

  // Le code saisi vit aussi dans une référence : au clavier, deux touches
  // peuvent arriver avant que l'écran ne se redessine, et la seconde ne doit
  // pas lire un code périmé.
  const saisi = useRef('');
  const occupeRef = useRef(false);

  const taper = async (touche) => {
    if (occupeRef.current) return;
    if (touche === '⌫') {
      saisi.current = saisi.current.slice(0, -1);
      setCode(saisi.current);
      return;
    }
    if (!/^[0-9]$/.test(touche) || saisi.current.length >= 4) return;
    saisi.current += touche;
    setCode(saisi.current);
    setErreur(null);
    if (saisi.current.length < 4) return;
    occupeRef.current = true;
    setOccupe(true);
    const message = await onValider(saisi.current);
    occupeRef.current = false;
    setOccupe(false);
    if (message) {
      setErreur(message);
      saisi.current = '';
      setCode('');
    }
  };

  useEffect(() => {
    const auClavier = (e) => {
      // Pavé numérique : « Numpad7 » donne 7, même Verr Num éteint (où la
      // touche dirait « Home »). Rangée du haut : le caractère suffit.
      const pave = /^Numpad([0-9])$/.exec(e.code || '');
      const chiffre = pave ? pave[1] : /^[0-9]$/.test(e.key) ? e.key : null;
      if (chiffre) taper(chiffre);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'NumpadDecimal') taper('⌫');
      else if (e.key === 'Escape' && onFermer) onFermer();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  });

  return (
    <div className="code-voile" role="dialog" aria-modal="true" aria-labelledby="code-titre">
      <div className={`code-carte ${erreur ? 'code-faux' : ''}`} ref={carte} tabIndex={-1}>
        <h2 id="code-titre" className="code-titre">{titre}</h2>
        {detail && <p className="code-detail">{detail}</p>}
        <div className="code-points" aria-label={t('entreprise.codeSaisi', { n: code.length })}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < code.length ? 'plein' : ''} />
          ))}
        </div>
        <p className="code-erreur" role="alert">{erreur || ' '}</p>
        <p className="code-astuce">{t('entreprise.auClavier')}</p>
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
        {extra}
        {onFermer && (
          <button className="btn btn-block code-annuler" type="button" onClick={onFermer}>
            {t('app.annuler')}
          </button>
        )}
      </div>
    </div>
  );
}
