import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

/**
 * Tableau de bord, réservé aux administrateurs.
 *
 * Le serveur décide : `is_admin()` et `cmp_stats()` vérifient l'appelant
 * eux-mêmes. Masquer l'onglet n'est qu'un confort d'affichage — quelqu'un qui
 * lirait le code trouverait l'appel, et se ferait refuser par la base.
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [foyers, setFoyers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase
      .rpc('is_admin')
      .then(({ data }) => {
        if (alive) setIsAdmin(data === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('cmp_stats');
    if (err) setError(err.message);
    else setStats(data);
    setLoading(false);
  }, []);

  /** Le détail des foyers, chargé seulement quand on le demande. */
  const chargerFoyers = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.rpc('cmp_foyers');
    if (err) setError(err.message);
    else setFoyers(Array.isArray(data) ? data : []);
  }, []);

  return { isAdmin, stats, foyers, loading, error, refresh, chargerFoyers };
}
