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

  if (!userId || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos o estructura inválida (userId, subscription.endpoint)' });
  }

  try {
    // Buscar si ya existe la suscripción de este usuario mediante el endpoint único del navegador
    const { data: existing, error: findError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('cliente_id', userId)
      .eq('subscription->>endpoint', subscription.endpoint)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      // Si existe, actualizamos la fecha de actualización
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      // Si no existe, creamos el registro
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          cliente_id: userId,
          subscription: subscription,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    }

    return res.status(200).json({ success: true, message: 'Suscripción push guardada con éxito.' });
  } catch (err: any) {
    console.error('Error in save-subscription api:', err);
    return res.status(500).json({ error: err.message });
  }
}
