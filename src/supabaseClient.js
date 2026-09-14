import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Vrai si les clés Supabase sont configurées à la compilation. */
export const isConfigured = Boolean(url && anonKey);

// Un seul client, avec session persistante (pas de reconnexion à chaque ouverture)
// et prise en charge du lien magique reçu dans l'URL.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
