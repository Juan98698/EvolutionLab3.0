import type { VercelRequest, VercelResponse } from './_lib/types';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { verifyAuth, isAuthError } from './_lib/verifyAuth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Llaves VAPID: SIN fallback hardcodeado. Si no están configuradas en el
// entorno, el endpoint debe fallar explícitamente en vez de usar una clave
// de ejemplo (una clave de ejemplo commiteada en el repo deja de ser un
// secreto real, así que nunca debe usarse como valor operativo).
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:soporte@evolutionlab.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utilizar POST.' });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('⚠️ send-push: VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas en el servidor.');
    return res.status(500).json({ error: 'El servicio de notificaciones push no está configurado en el servidor.' });
  }

  // 1. Autenticación obligatoria vía JWT — nunca confiar en un userId suelto en el body.
  const authResult = await verifyAuth(req);
  if (isAuthError(authResult)) {
    return res.status(authResult.status).json({ error: authResult.error });
  }
  const callerId = authResult.user.id;

  const { userId, title, body, icon, url } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: userId, title, body' });
  }

  try {
    // 2. Autorización: solo puede recibir el push el propio usuario autenticado,
    //    o un atleta cuyo entrenador_id coincida con el entrenador autenticado.
    if (callerId !== userId) {
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, entrenador_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!targetProfile || targetProfile.entrenador_id !== callerId) {
        console.warn(`⚠️ send-push: usuario ${callerId} intentó notificar a ${userId} sin relación de entrenador válida.`);
        return res.status(403).json({ error: 'No autorizado para enviar notificaciones a este usuario.' });
      }
    }

    // 3. Obtener las suscripciones push de este usuario
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
