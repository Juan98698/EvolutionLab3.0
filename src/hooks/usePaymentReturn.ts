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
const profileKey = (value: Profile | null) => JSON.stringify([value?.suscripcion_plan, value?.suscripcion_estado, value?.suscripcion_expira_at, value?.billing_payment_id]);

/**
 * true si el perfil ya refleja un pago recién aprobado del plan indicado.
 *
 * El ID persistido por el ledger confirma también renovaciones anticipadas.
 * Sin ID solo se admite el formato histórico de una aprobación reciente;
 * el hook exige además que el perfil cambie respecto al regreso del checkout.
 */
export function isPaymentReflected(
  profile: Pick<Profile, 'suscripcion_plan' | 'suscripcion_estado' | 'suscripcion_expira_at' | 'billing_payment_id'> | null,
  plan: string,
  now: number = Date.now(),
  paymentId?: string
): boolean {
  if (!profile?.suscripcion_plan || !profile.suscripcion_expira_at) return false;
  if (plan && profile.suscripcion_plan.toLowerCase() !== plan.toLowerCase()) return false;
  if (profile.suscripcion_estado && profile.suscripcion_estado !== 'activo') return false;

  const expiresAt = new Date(profile.suscripcion_expira_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  if (paymentId) return profile.billing_payment_id === paymentId;
  const inferredApproval = expiresAt - PLAN_DAYS_MS;
  return inferredApproval >= now - RECENT_APPROVAL_MARGIN_MS && inferredApproval <= now;
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
  const paymentIdRef = useRef<string>();
  const baselineRef = useRef<string>();

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
      paymentIdRef.current = params.get('payment_id') || params.get('collection_id') || undefined;
      baselineRef.current = profileKey(profile);
      setPendingPlan(params.get('plan') || '');
      showToastRef.current('Confirmando tu suscripción con MercadoPago…', 'info');
    } else if (status === 'pending') {
      showToastRef.current(
        'Tu pago quedó pendiente de aprobación. Activaremos tu plan apenas MercadoPago lo confirme.',
        'info'
      );
    } else if (cancelled) {
      showToastRef.current(messagesRef.current.cancel, 'info');
    }
    for (const key of ['payment_success', 'payment_cancel', 'plan', 'payment_id', 'collection_id', 'collection_status', 'status', 'external_reference', 'payment_type', 'merchant_order_id', 'preference_id', 'site_id', 'processing_mode', 'merchant_account_id']) params.delete(key);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
    // Profile is sampled once per checkout return, before polling starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.pathname, navigate]);

  useEffect(() => {
    if (pendingPlan === null) return;
    const changed = profileKey(profile) !== baselineRef.current;
    if ((paymentIdRef.current || changed) && isPaymentReflected(profile, pendingPlan, Date.now(), paymentIdRef.current)) {
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
          'La confirmación de tu pago está tardando más de lo normal. Recarga la app en unos minutos; si no se confirma, contáctanos.',
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
