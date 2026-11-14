import { createClient } from '@supabase/supabase-js';
import { observePasswordRecovery } from './passwordRecovery';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'ADVERTENCIA: Las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas. Usando placeholders para modo offline/test.'
  );
}

// Cliente Singleton expuesto para toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  }
});

// Subscribe at client creation, rather than in a lazy React screen: the SDK
// removes the recovery hash during initialization and can emit before it mounts.
supabase.auth.onAuthStateChange((event, session) => {
  observePasswordRecovery(event, session?.user.id || null);
});
