import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../context/SupabaseContext';
import type { Profile } from '../types/database.types';

type ToastType = 'success' | 'error' | 'info';

/** Cada cuánto se vuelve a leer el perfil mientras se espera al webhook. */
export const PAYMENT_POLL_INTERVAL_MS = 3000;
/** Tiempo máximo de espera antes de avisar que la activación está tardando. */
export const PAYMENT_POLL_TIMEOUT_MS = 60000;

const PLAN_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// Margen para relojes desfasados y pagos aprobados poco antes de volver a la app.
const RECENT_APPROVAL_MARGIN_MS = 2 * 60 * 60 * 1000;

/**
 * true si el perfil ya refleja un pago recién aprobado del plan indicado.
 *
 * El webhook guarda `suscripcion_expira_at = aprobación + 30 días`, así que un
 * vencimiento cuyo inicio cae en las últimas horas indica que este pago ya se
 * procesó. Comparar solo el nombre del plan no basta: en una renovación el
 * plan ya era el mismo antes de pagar.
 */
export function isPaymentReflected(
  profile: Pick<Profile, 'suscripcion_plan' | 'suscripcion_estado' | 'suscripcion_expira_at'> | null,
  plan: string,
  now: number = Date.now()
): boolean {
  if (!profile?.suscripcion_plan || !profile.suscripcion_expira_at) return false;
  if (plan && profile.suscripcion_plan.toLowerCase() !== plan.toLowerCase()) return false;
  if (profile.suscripcion_estado && profile.suscripcion_estado !== 'activo') return false;

  const expiresAt = new Date(profile.suscripcion_expira_at).getTime();
  if (isNaN(expiresAt)) return false;
  return expiresAt - PLAN_DAYS_MS >= now - RECENT_APPROVAL_MARGIN_MS;
}

interface PaymentReturnMessages {
  success: string;
  cancel: string;
}

/**
 * Maneja el regreso desde MercadoPago (`?payment_success=…` / `?payment_cancel=…`).
 *
 * El plan lo activa el webhook, que puede llegar unos segundos después de que
 * el usuario vuelve. En vez de anunciar "activado" de inmediato (y que el plan
 * siga gratuito hasta recargar), se muestra "Confirmando tu pago…" y se relee
 * el perfil cada pocos segundos hasta que refleje el pago o venza el tiempo.
 */
export function usePaymentReturn(
  showToast: (message: string, type: ToastType) => void,
  messages: PaymentReturnMessages
): { confirmingPayment: boolean } {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useSupabase();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  // Refs para usar siempre la versión actual sin reiniciar el sondeo.
  const showToastRef = useRef(showToast);
  const refreshProfileRef = useRef(refreshProfile);
  const messagesRef = useRef(messages);
  showToastRef.current = showToast;
  refreshProfileRef.current = refreshProfile;
  messagesRef.current = messages;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('payment_success');
    const cancelled = params.get('payment_cancel') === 'true';
    if (!status && !cancelled) return;

    if (status === 'true') {
      setPendingPlan(params.get('plan') || '');
      showToastRef.current('⏳ Pago recibido. Confirmando tu suscripción con MercadoPago…', 'info');
    } else if (status === 'pending') {
      showToastRef.current(
        'Tu pago quedó pendiente de aprobación. Activaremos tu plan apenas MercadoPago lo confirme.',
        'info'
      );
    } else if (cancelled) {
      showToastRef.current(messagesRef.current.cancel, 'info');
    }
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    if (pendingPlan === null) return;
    if (isPaymentReflected(profile, pendingPlan)) {
      showToastRef.current(messagesRef.current.success, 'success');
      setPendingPlan(null);
    }
  }, [profile, pendingPlan]);

  useEffect(() => {
    if (pendingPlan === null) return;
    refreshProfileRef.current();
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt >= PAYMENT_POLL_TIMEOUT_MS) {
        window.clearInterval(timer);
        showToastRef.current(
          'Recibimos tu pago, pero la activación está tardando más de lo normal. Recarga la app en unos minutos; si no se activa, contáctanos.',
          'info'
        );
        setPendingPlan(null);
        return;
      }
      refreshProfileRef.current();
    }, PAYMENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pendingPlan]);

  return { confirmingPayment: pendingPlan !== null };
}
