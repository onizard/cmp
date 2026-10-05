import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Header from './Header.jsx';
import CodeOperateur from './CodeOperateur.jsx';
import { personnes, entree } from '../lib/session.js';

/**
 * « Qui es-tu ? » : sur un téléphone partagé, chacun ouvre sa session.
 *
 * En famille, on touche son prénom, puis on tape son code s'il en a un. Un
 * autre adulte sans code ne peut pas être choisi : sans code, n'importe qui
 * agirait pour lui. En entreprise, le code seul suffit : c'est lui qui dit
 * qui l'on est.
 *
 * `onOuvrir(acteur)` : { id, nom, compte, proche, enfant } en famille,
 * { op, code, nom } en entreprise.
 */
export default function ChoixSession({ userId, rewards, equipe = null, onOuvrir, onRetour }) {
  const t = useT();
  const [demande, setDemande] = useState(null);
  const [note, setNote] = useState(null);

  if (equipe) {
    return (
      <div className="screen">
        <Header onRetour={onRetour} />
        <div className="panel session-choix">
          <p className="lede">{t('session.proInvite')}</p>
        </div>
        {/* Perso et pro sur ce téléphone : de là, on retourne au choix du
            compte. */}
        <CodeOperateur
          titre={t('codes.tonCode')}
          onFermer={onRetour}
          fermerLibelle={t('comptes.changer')}
          onValider={async (code) => {
            const r = await equipe.qui(code);
            if (r.erreur) return r.erreur === 'horsLigne' ? t('entreprise.horsLigne') : r.erreur;
            if (!r.op) return t('entreprise.codeInconnu');
            onOuvrir({ op: r.op, code, nom: equipe.noms[r.op] || '' });
            return null;
          }}
        />
      </div>
    );
  }

  const liste = personnes({
    userId,
    members: rewards.members,
    names: rewards.names,
    proches: rewards.proches,
  });

  const choisir = (p) => {
    setNote(null);
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
          {liste.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`session-nom ${p.enfant ? 'session-enfant' : ''}`}
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
            const r = await rewards.ouvrirCode(demande.id, code);
            if (r) return r === 'faux' ? t('codes.faux') : r;
            const p = demande;
            setDemande(null);
            onOuvrir(p);
            return null;
          }}
          onFermer={() => setDemande(null)}
        />
      )}
    </div>
  );
}
