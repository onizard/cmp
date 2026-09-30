import { origineWeb } from './natif.js';
import { useCallback, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../supabaseClient.js';
import { t } from '../i18n/index.js';
import {
  capturerInvitation,
  invitationEnAttente,
  oublierInvitation,
} from './invite.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LAST_HH = 'cmp.household';

// Cet appareil a-t-il déjà servi à se connecter ? Sinon, le premier écran
// propose de créer un compte plutôt que de se connecter. La déconnexion garde
// la marque ; seule la suppression du compte l'efface (clés « cmp… »).
const DEJA_VENU = 'cmp.dejaVenu';
export const dejaVenu = () => {
  try {
    return localStorage.getItem(DEJA_VENU) === '1';
  } catch {
    return false;
  }
};
const marquerVenu = () => {
  try {
    localStorage.setItem(DEJA_VENU, '1');
  } catch {
    /* ignore */
  }
};
const readLastHousehold = () => {
  try {
    return localStorage.getItem(LAST_HH);
  } catch {
    return null;
  }
};
const writeLastHousehold = (id) => {
  try {
    if (id) localStorage.setItem(LAST_HH, id);
    else localStorage.removeItem(LAST_HH);
  } catch {
    /* ignore */
  }
};

/** URL de redirection du lien magique (base incluse). */
const redirectTo = () => `${origineWeb()}${import.meta.env.BASE_URL}`;

/**
 * Gère la session, l'appartenance à un foyer, et les actions de connexion /
 * création / rattachement.
 */
export function useAccount() {
  // Dès l'ouverture : on retire le code de l'adresse et on le met de côté,
  // en attendant que la personne ait un compte auquel le rattacher.
  const [invitation, setInvitation] = useState(() => capturerInvitation());
  const [session, setSession] = useState(null);
  const [household, setHousehold] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  // Vrai quand on n'a PAS PU savoir si la personne a un foyer, ce qui n'est
  // pas la même chose que « elle n'en a pas ».
  const [lectureRatee, setLectureRatee] = useState(false);
  // Seul·e dans son foyer ? Null tant qu'on ne sait pas.
  const [seul, setSeul] = useState(null);

  // Session
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setHousehold(null);
        setLoading(false);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadHousehold = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    // Filtrer sur SON user_id est indispensable : la politique de sécurité
    // laisse voir tous les membres du foyer (c'est ainsi qu'on affiche le
    // prénom de l'autre), donc sans ce filtre on lisait la première ligne
    // venue — et chacun héritait du prénom de l'autre.
    const { data, error: err } = await supabase
      .from('members')
      .select('household_id, display_name, households(id, name)')
      .eq('user_id', session.user.id)
      .order('household_id');

    // La requête a échoué : on ne sait rien. Surtout ne pas conclure « aucun
    // foyer » et proposer d'en créer un — c'est ainsi qu'on fabrique des
    // doublons chez quelqu'un qui en avait déjà un.
    if (err) {
      setLectureRatee(true);
      setLoading(false);
      setReady(true);
      return;
    }
    setLectureRatee(false);

    if (data && data.length > 0) {
      // Quelqu'un peut appartenir à plusieurs foyers : on garde celui qu'il
      // utilisait déjà, sinon le premier, pour ne pas changer d'un coup.
      const last = readLastHousehold();
      const row = data.find((r) => r.household_id === last) || data[0];
      setHousehold(
        row.households || { id: row.household_id, name: 'Maison' },
      );
      writeLastHousehold(row.household_id);
      setDisplayName(row.display_name || '');
      setLoading(false);
      setReady(true);
      return;
    }

    // Aucun foyer, mais une invitation en poche : on la consomme ici. C'est
    // ce qui permet d'arriver directement dans le bon foyer après inscription.
    const attente = invitationEnAttente();
    if (attente) {
      const { error: e } = await supabase
        .from('members')
        .insert({ user_id: session.user.id, household_id: attente });
      oublierInvitation();
      setInvitation(null);
      if (!e) {
        const { data: apres } = await supabase
          .from('members')
          .select('household_id, display_name, households(id, name)')
          .eq('user_id', session.user.id)
          .eq('household_id', attente);
        if (apres && apres.length > 0) {
          const r = apres[0];
          writeLastHousehold(r.household_id);
          setHousehold(r.households || { id: r.household_id, name: 'Maison' });
          setDisplayName(r.display_name || '');
          setLoading(false);
          setReady(true);
          return;
        }
      }
      // Le code ne mène nulle part : on laisse l'écran d'accueil reprendre la main.
      setError(t('foyer.codeSansFoyer'));
    }

    setHousehold(null);
    setLoading(false);
    setReady(true);
  }, [session]);

  useEffect(() => {
    if (session) {
      marquerVenu();
      loadHousehold();
    }
  }, [session, loadHousehold]);

  // Combien sont-ils dans ce foyer ? La politique de sécurité laisse compter
  // les membres du sien, pas ceux des autres.
  useEffect(() => {
    if (!supabase || !household) return;
    let vivant = true;
    supabase
      .from('members')
      .select('user_id', { count: 'exact', head: true })
      .eq('household_id', household.id)
      .then(({ count, error: err }) => {
        if (vivant && !err) setSeul(count === 1);
      });
    return () => {
      vivant = false;
    };
  }, [household]);

  /** Connexion classique : e-mail + mot de passe, vérifiée sur place. */
  const signIn = useCallback(async (email, password) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(
        /invalid login/i.test(err.message)
          ? t('auth.identifiantsFaux')
          : err.message,
      );
      return false;
    }
    return true;
  }, []);

  /** Création d'un compte. Sans confirmation par mail : on entre aussitôt. */
  const signUp = useCallback(async (email, password) => {
    setError(null);
    if (password.length < 8) {
      setError(t('auth.motDePasseCourt'));
      return false;
    }
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (err) {
      if (!/already registered/i.test(err.message)) {
        setError(err.message);
        return false;
      }
      // Le compte existe déjà : c'est souvent quelqu'un qui revient sur un
      // appareil neuf (ou l'app de l'écran d'accueil, qui ne partage rien avec
      // Safari). Avec le bon mot de passe, on le fait entrer directement.
      const { error: err2 } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!err2) return true;
      setError(t('auth.dejaInscrit'));
      return 'dejaInscrit';
    }
    // Si le serveur exige encore une confirmation, aucune session n'est ouverte.
    if (!data.session) {
      setError(
        t('auth.confirmationRequise'),
      );
      return false;
    }
    return true;
  }, []);

  /** Issue de secours : le lien par mail, pour qui n'a pas encore de mot de passe. */
  const sendMagicLink = useCallback(async (email) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  }, []);

  /** Pose ou change le mot de passe du compte déjà connecté. */
  const setPassword = useCallback(async (password) => {
    setError(null);
    if (password.length < 8) {
      setError(t('auth.motDePasseCourt'));
      return false;
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    writeLastHousehold(null);
    await supabase?.auth.signOut();
  }, []);

  const createHousehold = useCallback(async () => {
    setError(null);
    // On revérifie juste avant de créer : entre l'affichage de l'écran et le
    // clic, la personne peut très bien avoir déjà un foyer.
    const { data: deja, error: eDeja } = await supabase
      .from('members')
      .select('household_id, display_name, households(id, name)')
      .eq('user_id', session.user.id)
      .limit(1);
    if (eDeja) {
      setError(eDeja.message);
      return;
    }
    if (deja && deja.length > 0) {
      const r = deja[0];
      writeLastHousehold(r.household_id);
      setHousehold(r.households || { id: r.household_id, name: 'Maison' });
      setDisplayName(r.display_name || '');
      return;
    }
    const { data: h, error: e1 } = await supabase
      .from('households')
      .insert({ name: 'Maison' })
      .select()
      .single();
    if (e1) {
      setError(e1.message);
      return;
    }
    const { error: e2 } = await supabase
      .from('members')
      .insert({ user_id: session.user.id, household_id: h.id });
    if (e2) {
      setError(e2.message);
      return;
    }
    writeLastHousehold(h.id);
    setHousehold(h);
  }, [session]);

  const joinHousehold = useCallback(
    async (code) => {
      setError(null);
      const clean = code.trim();
      if (!UUID_RE.test(clean)) {
        setError(t('foyer.codeInvalide'));
        return;
      }
      const { error: err } = await supabase
        .from('members')
        .insert({ user_id: session.user.id, household_id: clean });
      if (err) {
        setError(
          err.code === '23503'
            ? t('foyer.codeInconnu')
            : err.message,
        );
        return;
      }
      writeLastHousehold(clean);
      await loadHousehold();
    },
    [session, loadHousehold],
  );

  const updateDisplayName = useCallback(
    async (name) => {
      const clean = name.trim();
      if (!supabase || !session || !household) return false;
      const { error: err } = await supabase
        .from('members')
        .update({ display_name: clean })
        .eq('user_id', session.user.id)
        .eq('household_id', household.id);
      if (err) {
        setError(err.message);
        return false;
      }
      setDisplayName(clean);
      return true;
    },
    [session, household],
  );

  /**
   * Supprime définitivement son propre compte.
   * La fonction serveur ne prend aucun paramètre : elle ne peut agir que sur
   * l'appelant. Les tâches d'un foyer partagé restent à l'autre.
   */
  const supprimerLeCompte = useCallback(async () => {
    setError(null);
    if (!supabase) return 'Hors ligne.';
    const { error: err } = await supabase.rpc('cmp_supprimer_mon_compte');
    // On renvoie le message plutôt qu'un booléen : l'état React n'est pas
    // encore à jour au retour de l'await, l'appelant lirait l'ancien.
    if (err) {
      setError(err.message);
      return err.message || 'Erreur inconnue.';
    }
    // Plus rien ne doit survivre sur l'appareil non plus.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('cmp'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    return null;
  }, []);

  const leaveHousehold = useCallback(async () => {
    if (!supabase || !session || !household) return;
    await supabase
      .from('members')
      .delete()
      .eq('user_id', session.user.id)
      .eq('household_id', household.id);
    writeLastHousehold(null);
    setHousehold(null);
    setDisplayName('');
  }, [session, household]);

  return {
    isConfigured,
    invitation,
    lectureRatee,
    seul,
    reessayer: loadHousehold,
    session,
    household,
    displayName,
    loading,
    ready,
    error,
    signIn,
    signUp,
    sendMagicLink,
    setPassword,
    signOut,
    createHousehold,
    joinHousehold,
    updateDisplayName,
    leaveHousehold,
    supprimerLeCompte,
  };
}
