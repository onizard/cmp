import { useCallback, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../supabaseClient.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL de redirection du lien magique (base incluse). */
const redirectTo = () =>
  `${window.location.origin}${import.meta.env.BASE_URL}`;

/**
 * Gère la session, l'appartenance à un foyer, et les actions de connexion /
 * création / rattachement.
 */
export function useAccount() {
  const [session, setSession] = useState(null);
  const [household, setHousehold] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

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
    const { data, error: err } = await supabase
      .from('members')
      .select('household_id, display_name, households(id, name)')
      .limit(1);
    if (!err && data && data.length > 0) {
      const row = data[0];
      setHousehold(
        row.households || { id: row.household_id, name: 'Maison' },
      );
      setDisplayName(row.display_name || '');
    } else {
      setHousehold(null);
    }
    setLoading(false);
    setReady(true);
  }, [session]);

  useEffect(() => {
    if (session) loadHousehold();
  }, [session, loadHousehold]);

  const signInWithEmail = useCallback(async (email) => {
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

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const createHousehold = useCallback(async () => {
    setError(null);
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
    setHousehold(h);
  }, [session]);

  const joinHousehold = useCallback(
    async (code) => {
      setError(null);
      const clean = code.trim();
      if (!UUID_RE.test(clean)) {
        setError("Ce code d'invitation n'est pas valide.");
        return;
      }
      const { error: err } = await supabase
        .from('members')
        .insert({ user_id: session.user.id, household_id: clean });
      if (err) {
        setError(
          err.code === '23503'
            ? "Aucun foyer ne correspond à ce code."
            : err.message,
        );
        return;
      }
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

  const leaveHousehold = useCallback(async () => {
    if (!supabase || !session || !household) return;
    await supabase
      .from('members')
      .delete()
      .eq('user_id', session.user.id)
      .eq('household_id', household.id);
    setHousehold(null);
    setDisplayName('');
  }, [session, household]);

  return {
    isConfigured,
    session,
    household,
    displayName,
    loading,
    ready,
    error,
    signInWithEmail,
    signOut,
    createHousehold,
    joinHousehold,
    updateDisplayName,
    leaveHousehold,
  };
}
