import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Método no permitido. Utilizar POST.' });
  }

  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: userId, subscription' });
  }

  try {
    // Buscar si ya existe una suscripción idéntica o si actualizamos
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        cliente_id: userId,
        subscription: subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: 'cliente_id,subscription' }); // Si soporta, o simplemente guardamos múltiples suscripciones (dispositivos)

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Suscripción push guardada con éxito.' });
  } catch (err: any) {
    console.error('Error in save-subscription api:', err);
    return res.status(500).json({ error: err.message });
  }
}
