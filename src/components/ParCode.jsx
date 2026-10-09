import { useT } from '../i18n/index.js';
import CodeOperateur from './CodeOperateur.jsx';
import { personnes } from '../lib/session.js';

/**
 * Sur la liste des tâches : le code seul dit qui l'on est. Sans code (un
 * enfant, par exemple), ou si deux membres ont choisi le même, on passe aux
 * prénoms (`onPrenoms(raison)`).
 */
export default function ParCode({ userId, rewards, equipe = null, onOuvrir, onFermer, onPrenoms }) {
  const t = useT();

  const valider = async (code) => {
    if (equipe) {
      const r = await equipe.qui(code);
      if (r.erreur) return r.erreur === 'horsLigne' ? t('entreprise.horsLigne') : r.erreur;
      if (!r.op) return t('entreprise.codeInconnu');
      const nom = (equipe.membres.find((m) => m.id === r.op) || {}).nom || '';
      onOuvrir({ id: r.op, op: r.op, code, nom });
      return null;
    }
    const r = await rewards.quiCode(code);
    if (r.erreur) return r.erreur === 'horsLigne' ? t('entreprise.horsLigne') : r.erreur;
    if (r.ambigu) {
      onPrenoms('ambigu');
      return null;
    }
    const p = r.membre
      && personnes({ userId, members: rewards.members, names: rewards.names, proches: rewards.proches })
        .find((x) => x.id === r.membre);
    if (!p) return t('codes.faux');
    onOuvrir(p);
    return null;
  };

  return (
    <CodeOperateur
      titre={t('codes.tonCode')}
      onValider={valider}
      onFermer={onFermer}
      extra={
        equipe ? null : (
          <button type="button" className="link code-sans" onClick={() => onPrenoms(null)}>
            {t('session.pasDeCode')}
          </button>
        )
      }
    />
  );
}
