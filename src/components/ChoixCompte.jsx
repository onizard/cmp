import { useT } from '../i18n/index.js';
import Header from './Header.jsx';
import Comptes from './Comptes.jsx';

/**
 * La page de choix des comptes, quand l'appareil en garde plusieurs (perso
 * et pro) : l'appli s'ouvre dessus, et la flèche en haut à gauche des tâches
 * y ramène. Pas d'onglet : on n'y vient que par là.
 */
export default function ChoixCompte({ courant, onFini }) {
  const t = useT();
  return (
    <div className="screen">
      <Header />
      <div className="panel">
        <p className="lede">{t('comptes.titre')}</p>
        <Comptes courant={courant} ajout={false} choix onChoisi={onFini} />
      </div>
    </div>
  );
}
