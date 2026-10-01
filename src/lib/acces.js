// Rejoindre un compte pro sans en connaître le mot de passe.
//
// L'équipier donne l'adresse e-mail du compte pro ; la base lui rend un code
// de liaison de 8 caractères, qu'il transmet à l'administrateur. Celui-ci
// reçoit un mail, tape le code et accepte (nas/db/acces.sql). Le service
// d'envoi fabrique alors une connexion à usage unique au compte pro : ce
// téléphone la récupère, l'ouvre avec un client jetable (le compte perso
// reste ouvert) et la range parmi les comptes de l'appareil.
import { useCallback, useEffect, useState } from 'react';
import { supabase, clientSansMemoire } from '../supabaseClient.js';
import { memoriser } from './comptes.js';

const CLE = 'cmp.acces';

/** La demande en attente de ce compte, s'il y en a une. */
export function lireDemande(userId) {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null');
    return d && d.id && d.demandeur === userId ? d : null;
  } catch {
    return null;
  }
}

function ecrire(d) {
  try {
    if (d) localStorage.setItem(CLE, JSON.stringify(d));
    else localStorage.removeItem(CLE);
  } catch {
    /* navigation privée : on fait sans */
  }
}

/** « k7qm 4xpr » → « K7QM-4XPR », au fil de la frappe. */
export function formaterCode(saisie) {
  const brut = String(saisie || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return brut.length > 4 ? `${brut.slice(0, 4)}-${brut.slice(4)}` : brut;
}

export const codeComplet = (code) => formaterCode(code).length === 9;

/**
 * Ouvre la connexion à usage unique sans toucher au compte en cours, et la
 * range. Renvoie l'identifiant du compte pro, ou null si ça n'a pas pris.
 */
async function ouvrirPro(id, jeton, nom) {
  const c = clientSansMemoire();
  if (!c) return null;
  const { data, error } = await c.auth.verifyOtp({ token_hash: jeton, type: 'magiclink' });
  if (error || !data || !data.session) return null;
  // Cette connexion-là est celle du téléphone : l'administrateur pourra la
  // retirer depuis Équipe.
  await c.rpc('cmp_acces_lier', { p_id: id });
  memoriser({ session: data.session, nom: nom || '', type: 'pro' });
  return data.session.user.id;
}

/**
 * La demande de ce compte, suivie tant qu'elle attend : toutes les quelques
 * secondes quand l'appli est à l'écran, et à chaque retour dessus.
 * `annonce` : la réponse, une fois arrivée ({ statut, nom, proId }).
 */
export function useAcces(userId) {
  const [demande, setDemande] = useState(() => lireDemande(userId));
  const [annonce, setAnnonce] = useState(null);

  const verifier = useCallback(async () => {
    const d = lireDemande(userId);
    if (!d || !supabase) return;
    const { data, error } = await supabase.rpc('cmp_acces_etat', { p_id: d.id });
    if (error || !data || data.statut === 'attente') return;
    if (data.statut === 'acceptee') {
      // Le service fabrique la connexion dans la foulée : on repasse sinon.
      if (!data.jeton) return;
      const proId = await ouvrirPro(d.id, data.jeton, data.nom);
      if (!proId) return;
      await supabase.rpc('cmp_acces_fini', { p_id: d.id });
      ecrire(null);
      setDemande(null);
      setAnnonce({ statut: 'acceptee', nom: data.nom || d.nom, proId });
      return;
    }
    ecrire(null);
    setDemande(null);
    if (['refusee', 'bloquee', 'expiree'].includes(data.statut)) {
      setAnnonce({ statut: data.statut, nom: data.nom || d.nom });
    }
  }, [userId]);

  useEffect(() => {
    if (!demande) return undefined;
    verifier();
    const visible = () => document.visibilityState === 'visible';
    const minuteur = setInterval(() => {
      if (visible()) verifier();
    }, 8000);
    const auRetour = () => {
      if (visible()) verifier();
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [demande, verifier]);

  /** Renvoie null, ou 'inconnu' | 'deja' | 'trop' | 'soi' | un message. */
  const envoyer = useCallback(
    async (email, langue) => {
      if (!supabase) return 'indisponible';
      const { data, error } = await supabase.rpc('cmp_acces_demander', {
        p_email: String(email || '').trim(),
        p_langue: langue || 'fr',
      });
      if (error) return error.message;
      if (!data || data.erreur) return (data && data.erreur) || 'indisponible';
      const d = { id: data.id, code: data.code, nom: data.nom, email: String(email).trim().toLowerCase(), demandeur: userId };
      ecrire(d);
      setDemande(d);
      return null;
    },
    [userId],
  );

  const annuler = useCallback(async () => {
    const d = lireDemande(userId);
    if (d && supabase) await supabase.rpc('cmp_acces_annuler', { p_id: d.id });
    ecrire(null);
    setDemande(null);
  }, [userId]);

  return { demande, envoyer, annuler, annonce, finAnnonce: () => setAnnonce(null) };
}

/** Le lien du mail de l'administrateur : ?acces=…&cle=…&r=oui|non. */
export function lireDecision(search = typeof window !== 'undefined' ? window.location.search : '') {
  const p = new URLSearchParams(search);
  const id = p.get('acces');
  const cle = p.get('cle');
  if (!id || !cle) return null;
  return { id, cle, r: p.get('r') === 'non' ? 'non' : 'oui' };
}
