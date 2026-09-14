import { createClient } from '@supabase/supabase-js';

// URL de l'API : soit fournie au build (VITE_SUPABASE_URL), soit l'origine
// courante — car sur le NAS l'app et l'API sont servies par la même passerelle.
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

// La clé anon est publique par nature (la sécurité repose sur les policies RLS).
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Vrai si la clé anon est configurée. */
export const isConfigured = Boolean(url && anonKey);

// Un seul client, session persistante, prise en charge du lien magique dans l'URL.
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
