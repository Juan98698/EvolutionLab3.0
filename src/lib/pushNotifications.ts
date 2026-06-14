// src/lib/pushNotifications.ts
// Gestión de suscripciones y permisos de notificaciones push en el navegador

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BFGv5gZkL0vN-aC1V0dTL2m_k4v5XnNlV3gZ6L7vN8c9d0e1f2a3b4c5d6e7f8a9';

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
 * Solicita permisos e inscribe al usuario en el servicio push.
 * Envía la suscripción resultante al servidor de Evolution Lab.
 */
export async function subscribirNotificacionesPush(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta notificaciones push.');
    return false;
  }

  try {
    // 1. Obtener registro del Service Worker activo
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.warn('El Service Worker no está listo.');
      return false;
    }

    // 2. Solicitar permiso al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso para notificaciones push denegado por el usuario.');
      return false;
    }

    // 3. Suscribirse con VAPID public key
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('Suscrito a notificaciones push exitosamente en PWA:', subscription);

    // 4. Registrar la suscripción en el backend a través de la API Serverless
    const response = await fetch('/api/save-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        subscription,
      }),
    });

    const result = await response.json();
    return response.ok && result.success;
  } catch (err) {
    console.error('Error al suscribir a notificaciones push:', err);
    return false;
  }
}

/**
 * Comprueba si el usuario tiene actualmente activa la suscripción push.
 */
export async function verificarSuscripcionPushActiva(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null && Notification.permission === 'granted';
  } catch (err) {
    console.warn('Error al verificar suscripción push:', err);
    return false;
  }
}
