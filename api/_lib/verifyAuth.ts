import type { VercelRequest } from './types';
import { createClient, User } from '@supabase/supabase-js';

/**
 * Verifica la cabecera "Authorization: Bearer <token>" contra Supabase Auth
 * y devuelve el usuario autenticado. NUNCA confiar en un userId que venga
 * del body/query de la request — el único userId de confianza es el que
 * devuelve este verificador a partir del JWT firmado.
 *
 * Reutiliza el mismo patrón ya usado en create-mercadopago-preference.ts.
 */
export async function verifyAuth(
  req: VercelRequest
): Promise<{ user: User } | { error: string; status: number }> {
  const authHeader = req.headers.authorization || (req.headers as any).Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { error: 'Acceso no autorizado: se requiere cabecera Authorization con token de sesión.', status: 401 };
  }

  const token = authHeader.substring(7);
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Variables de entorno de Supabase no configuradas en el servidor.');
    return { error: 'Error de configuración en el servidor.', status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Sesión no válida o expirada. Por favor inicie sesión nuevamente.', status: 401 };
  }

  return { user };
}

/** Type guard para distinguir el resultado de éxito del de error. */
export function isAuthError(
  result: { user: User } | { error: string; status: number }
): result is { error: string; status: number } {
  return (result as any).error !== undefined;
}
