import { useEffect } from 'react';
import { useT } from '../i18n/index.js';
import { COMBO_BONUS, formatPoints } from '../lib/gamify.js';

/**
 * L'annonce du combo : elle éclate au milieu de l'écran avec le demi-point
 * gagné, brille, puis s'en va toute seule. Elle ne prend jamais le clic — on doit pouvoir enchaîner une
 * autre tâche pendant qu'elle est encore là.
 *
 * `cle` change à chaque annonce et sert de clé de montage : deux coches
 * rapprochées rejouent l'animation au lieu de la laisser figée sur place.
 */
export default function Combo({ n, cle, onFini }) {
  const t = useT();

  useEffect(() => {
    const fin = setTimeout(onFini, 1400);
    return () => clearTimeout(fin);
  }, [cle, onFini]);

  if (!n || n < 2) return null;

  return (
    <div className="combo-layer" aria-live="polite">
      <div className="combo-bloc" key={cle}>
        <strong className="combo">{t('taches.combo')}</strong>
        <strong className="combo combo-plus">
          {t('taches.comboPlus', { p: formatPoints(COMBO_BONUS) })}
        </strong>
      </div>
    </div>
  );
}
