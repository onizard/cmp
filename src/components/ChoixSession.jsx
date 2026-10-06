import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Header from './Header.jsx';
import CodeOperateur from './CodeOperateur.jsx';
import { personnes, entree } from '../lib/session.js';

/**
 * « Qui es-tu ? » : sur un téléphone partagé, chacun ouvre sa session.
 *
 * On touche son prénom, puis on tape son code s'il en a un. Un autre adulte
 * sans code ne peut pas être choisi : sans code, n'importe qui agirait pour
 * lui. En entreprise, chacun a le sien.
 *
 * `onOuvrir(acteur)` : { id, nom, compte, proche, enfant } en famille,
 * { op, code, nom } en entreprise.
 */
export default function ChoixSession({ userId, rewards, equipe = null, onOuvrir, onRetour }) {
  const t = useT();
  const [demande, setDemande] = useState(null);
  const [note, setNote] = useState(null);

  // En entreprise : les membres actifs de l'équipe, chacun avec son code.
  const liste = equipe
    ? equipe.membres
        .filter((m) => m.actif)
        .map((m) => ({ id: m.id, nom: m.nom, op: m.id, enfant: false }))
    : personnes({
        userId,
        members: rewards.members,
        names: rewards.names,
        proches: rewards.proches,
      });
  // Tant que les membres ne sont pas connus, aucun prénom : on n'affiche pas
  // un « sans prénom » qui se corrige l'instant d'après.
  const affiches = !equipe && (rewards.members || []).length === 0 ? [] : liste;
  // Avant la première lecture, qui a un code n'est pas sûr : on attend.
  const pret = equipe ? true : rewards.pret;

  // Le code tapé est-il celui de cette personne ?
  const verifier = async (p, code) => {
    if (equipe) {
      const r = await equipe.qui(code);
      if (r.erreur) return r.erreur === 'horsLigne' ? t('entreprise.horsLigne') : r.erreur;
      if (r.op !== p.id) return t('codes.faux');
      return null;
    }
    const r = await rewards.ouvrirCode(p.id, code);
    if (r) return r === 'faux' ? t('codes.faux') : r;
    return null;
  };

  const choisir = (p) => {
    setNote(null);
    if (equipe) {
      setDemande(p);
      return;
    }
    const mode = entree(p, userId, rewards.avecCode);
    if (mode === 'direct') {
      onOuvrir(p);
      return;
    }
    if (mode === 'sansCode') {
      setNote(t('session.sansCode', { nom: p.nom || t('famille.sansPrenom') }));
      return;
    }
    setDemande(p);
  };

  return (
    <div className="screen">
      <Header onRetour={onRetour} />
      <div className="panel session-choix">
        <p className="lede">{t('session.qui')}</p>
        <div className="session-noms">
          {affiches.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`session-nom ${p.enfant ? 'session-enfant' : ''}`}
              disabled={!pret}
              onClick={() => choisir(p)}
            >
              <span className="session-initiale" aria-hidden="true">
                {(p.nom || '?').trim().charAt(0).toUpperCase()}
              </span>
              <span className="session-prenom">{p.nom || t('famille.sansPrenom')}</span>
            </button>
          ))}
        </div>
        {note && <p className="setnote session-note" role="status">{note}</p>}
      </div>
      {demande && (
        <CodeOperateur
          titre={t('codes.titre', { nom: demande.nom || t('famille.sansPrenom') })}
          onValider={async (code) => {
            const r = await verifier(demande, code);
            if (r) return r;
            const p = demande;
            setDemande(null);
            // En entreprise, le code reste en mémoire le temps de la session :
            // il signe chaque action (TaskList).
            onOuvrir(equipe ? { op: p.id, code, nom: p.nom } : p);
            return null;
          }}
          onFermer={() => setDemande(null)}
        />
      )}
    </div>
  );
}
