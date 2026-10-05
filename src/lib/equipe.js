// Mode entreprise : l'équipe et ses codes opérateur.
//
// L'application ne voit que les noms. Les codes vivent chiffrés dans la base,
// qui seule les vérifie (nas/db/entreprise.sql) : un code faux y est compté,
// et dix codes faux en cinq minutes bloquent le compte un moment.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

/** Un code opérateur : exactement 4 chiffres. */
export const codeOperateurValide = (code) => /^[0-9]{4}$/.test(String(code || ''));

/** Un code responsable : 4 à 8 chiffres. */
export const codeResponsableValide = (code) => /^[0-9]{4,8}$/.test(String(code || ''));

/**
 * Les tâches vues « par opérateur » : qui a créé, qui a coché. C'est ce qui
 * permet de réutiliser tel quel le calcul des points et du combo, écrit pour
 * des personnes connectées.
 */
export const tachesParOperateur = (tasks) =>
  (tasks || []).map((t) => ({ ...t, createdBy: t.createdOp || null, doneBy: t.doneOp || null }));

/** Les membres de l'équipe : { id, nom, actif }, actifs d'abord, puis par nom. */
export function useEquipe(householdId, actif) {
  const [membres, setMembres] = useState([]);

  const refresh = useCallback(async () => {
    if (!actif || !supabase || !householdId) return;
    const { data } = await supabase
      .from('operateurs')
      .select('id, nom, actif')
      .eq('household_id', householdId);
    if (data) {
      setMembres(
        data
          .slice()
          .sort(
            (a, b) =>
              Number(b.actif) - Number(a.actif) ||
              a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }),
          ),
      );
    }
  }, [householdId, actif]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Le code responsable est-il bon ? */
  const verifierResponsable = useCallback(
    async (code) => {
      const { data, error } = await supabase.rpc('cmp_responsable_verifier', {
        hid: householdId,
        p_code: code,
      });
      if (error) return error.message;
      return data ? null : 'faux';
    },
    [householdId],
  );

  /**
   * Ajoute (id nul) ou modifie un membre. `code` nul : inchangé. Renvoie null
   * si tout va bien, sinon un message (ou 'faux' pour le code responsable).
   */
  const enregistrer = useCallback(
    async (responsable, { id = null, nom, code = null, actif: estActif = true }) => {
      const { data, error } = await supabase.rpc('cmp_operateur_enregistrer', {
        hid: householdId,
        p_responsable: responsable,
        p_id: id,
        p_nom: nom,
        p_code: code,
        p_actif: estActif,
      });
      if (error) return error.code === '23505' ? 'pris' : error.message;
      if (!data) return 'faux';
      await refresh();
      return null;
    },
    [householdId, refresh],
  );

  /** Les téléphones reliés au compte pro (lib/acces.js), ou 'faux'. */
  const relies = useCallback(
    async (responsable) => {
      const { data, error } = await supabase.rpc('cmp_acces_relies', {
        hid: householdId,
        p_responsable: responsable,
      });
      if (error) return error.message;
      if (!data || data.erreur) return (data && data.erreur) || 'faux';
      return data.relies || [];
    },
    [householdId],
  );

  /** Retire l'accès d'un téléphone relié. Renvoie null si c'est fait. */
  const retirer = useCallback(async (responsable, id) => {
    const { data, error } = await supabase.rpc('cmp_acces_retirer', {
      p_id: id,
      p_responsable: responsable,
    });
    if (error) return error.message;
    return data === 'ok' ? null : data;
  }, []);

  /**
   * Un nouveau code responsable, avec l'ancien (vérifié par la base, qui
   * compte les essais). Renvoie null, 'faux', 'format' ou un message.
   */
  const changerCodeResponsable = useCallback(async (ancien, nouveau) => {
    const { data, error } = await supabase.rpc('cmp_entreprise_code_responsable_changer', {
      p_ancien: ancien,
      p_nouveau: nouveau,
    });
    if (error) return error.message;
    return data === 'ok' ? null : data;
  }, []);

  /**
   * Qui porte ce code ? Pour ouvrir une session : { op } (nul si le code est
   * faux, l'essai compte), ou { erreur }.
   */
  const qui = useCallback(
    async (code) => {
      if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        return { erreur: 'horsLigne' };
      }
      const { data, error } = await supabase.rpc('cmp_operateur_qui', { hid: householdId, p_code: code });
      if (error) return { erreur: error.message };
      return { op: data || null };
    },
    [householdId],
  );

  const noms = Object.fromEntries(membres.map((m) => [m.id, m.nom]));
  return { membres, noms, refresh, qui, verifierResponsable, enregistrer, relies, retirer, changerCodeResponsable };
}
