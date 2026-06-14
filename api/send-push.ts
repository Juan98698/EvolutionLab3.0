import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configurar llaves VAPID (fallback de desarrollo por si no están configuradas en Vercel)
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || 'BNXllPMOAb4gZfbJx_wO_MOeozQjZTTFxyPSwXPBCRgOebjYoPRWeLgfySgqCyj0_o7exBTN4ttD_yxtFv63N7Q';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'BcUaRTZ9a8VVs_S6yrT6ZmGQfWfAjPT7w_vz3pyXaUI';

webpush.setVapidDetails(
  'mailto:soporte@evolutionlab.com',
  vapidPublicKey,
  vapidPrivateKey
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Método no permitido. Utilizar POST.' });
  }

  const { userId, title, body, icon, url } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: userId, title, body' });
  }

  try {
    // Obtener las suscripciones push de este usuario
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('cliente_id', userId);

    if (error) throw error;

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, message: 'El usuario no tiene suscripciones push registradas.' });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192.png',
      url: url || '/dashboard'
    });

    const sendPromises = subs.map(async (row) => {
      const sub = row.subscription as any;
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err: any) {
        // Si la suscripción ha expirado o no es válida, la removemos de la BD
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.warn(`Removiendo suscripción push expirada id: ${row.id}`);
          await supabase.from('push_subscriptions').delete().eq('id', row.id);
        } else {
          console.error(`Error al enviar push a sub id ${row.id}:`, err);
        }
      }
    });

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true, message: 'Notificación push enviada con éxito.' });
  } catch (err: any) {
    console.error('Error in send-push api:', err);
    return res.status(500).json({ error: err.message });
  }
}
