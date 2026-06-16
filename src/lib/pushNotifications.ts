// src/lib/pushNotifications.ts
// Gestión de suscripciones y permisos de notificaciones push en el navegador
import { supabase } from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BNXllPMOAb4gZfbJx_wO_MOeozQjZTTFxyPSwXPBCRgOebjYoPRWeLgfySgqCyj0_o7exBTN4ttD_yxtFv63N7Q';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Obtiene el Service Worker registrado con un timeout de seguridad.
 * Evita que navigator.serviceWorker.ready se quede colgada indefinidamente
 * en desarrollo local o cuando el SW aún no está listo.
 */
async function getServiceWorkerRegistration(timeoutMs: number = 8000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Intentar obtener un registration existente primero (más rápido)
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      // Si alguno tiene un SW activo, usarlo directamente
      const activeReg = registrations.find(r => r.active);
      if (activeReg) return activeReg;
    }

    // Si no hay SW activo, esperar con timeout a que se registre
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([readyPromise, timeoutPromise]);
    return result;
  } catch (err) {
    console.warn('Error obteniendo Service Worker registration:', err);
    return null;
  }
}

/**
 * Solicita permisos e inscribe al usuario en el servicio push.
 * Guarda la suscripción directamente en Supabase (tabla push_subscriptions).
 */
export async function subscribirNotificacionesPush(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Este navegador no soporta notificaciones push.');
    return false;
  }

  try {
    // 1. Solicitar permiso al usuario PRIMERO (no requiere SW)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Permiso denegado por el usuario.');
      return false;
    }

    // 2. Obtener registro del Service Worker con timeout
    const registration = await getServiceWorkerRegistration(8000);
    if (!registration) {
      console.warn('[Push] No se pudo obtener el Service Worker. La app debe estar instalada como PWA o usar HTTPS.');
      return false;
    }

    // 3. Suscribirse con VAPID public key
    let subscription: PushSubscription | null = null;
    try {
      // Intentar obtener suscripción existente primero
      subscription = await registration.pushManager.getSubscription();

      // Si no hay suscripción existente, crear una nueva
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
    } catch (pushErr) {
      console.error('[Push] Error al suscribirse al PushManager:', pushErr);
      return false;
    }

    if (!subscription) {
      console.warn('[Push] No se pudo crear la suscripción push.');
      return false;
    }

    console.log('[Push] Suscripción push obtenida exitosamente:', subscription.endpoint);

    // 4. Convertir a objeto plano serializable para Supabase
    const subJson = subscription.toJSON();
    if (!subJson.endpoint) {
      subJson.endpoint = subscription.endpoint;
    }

    // 5. Guardar en Supabase directamente (RLS permite al usuario autenticado)
    // Primero intentar buscar si ya existe
    const { data: existing, error: findError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('cliente_id', userId)
      .maybeSingle();

    if (findError) {
      console.warn('[Push] Error buscando suscripción previa:', findError.message);
      // No lanzar error, intentar insertar de todas formas
    }

    if (existing) {
      // Actualizar suscripción existente con los datos nuevos
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          subscription: subJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Push] Error al actualizar suscripción:', updateError.message);
        throw updateError;
      }
      console.log('[Push] Suscripción existente actualizada correctamente.');
    } else {
      // Insertar nueva suscripción
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          cliente_id: userId,
          subscription: subJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Push] Error al insertar suscripción:', insertError.message);
        throw insertError;
      }
      console.log('[Push] Nueva suscripción push guardada correctamente.');
    }

    return true;
  } catch (err: any) {
    console.error('[Push] Error general al suscribir:', err?.message || err);
    return false;
  }
}

/**
 * Comprueba si el usuario tiene actualmente activa la suscripción push
 * tanto en su navegador local como registrada en la base de datos de Supabase.
 */
export async function verificarSuscripcionPushActiva(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    // 1. Comprobar estado local en el navegador
    const registration = await getServiceWorkerRegistration(3000);
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    const localActiva = subscription !== null && Notification.permission === 'granted';

    if (!localActiva) {
      return false;
    }

    // 2. Comprobar que realmente exista guardada en Supabase
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('cliente_id', userId)
      .maybeSingle();

    if (error || !data) {
      console.warn('[Push] Suscripción local activa pero ausente en Supabase (o acceso restringido).');
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Push] Error al verificar suscripción push:', err);
    return false;
  }
}
